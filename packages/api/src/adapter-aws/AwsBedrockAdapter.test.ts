import {describe, expect, test} from 'bun:test'
import {
    CreateGuardrailCommand,
    DeleteGuardrailCommand,
    GetGuardrailCommand,
    ListGuardrailsCommand,
    type BedrockClient,
} from '@aws-sdk/client-bedrock'
import {AwsBedrockAdapter} from './AwsBedrockAdapter'
import {ValidationError} from '../cloud-spi/errors'

type SendResult = Record<string, unknown>

/** Minimal BedrockClient stub that records the commands it was sent. */
function stubBedrock(handler: (command: object) => SendResult | Promise<SendResult>) {
    const sent: object[] = []
    const client = {
        async send(command: object) {
            sent.push(command)
            return handler(command)
        },
    } as unknown as BedrockClient
    return {client, sent}
}

const ARN = 'arn:aws:bedrock:eu-central-1:000000000000:guardrail/abc123def456'

const summary = {
    id: 'abc123def456',
    arn: ARN,
    name: 'pii-filter',
    status: 'READY',
    version: 'DRAFT',
    description: 'blocks PII',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
}

describe('AwsBedrockAdapter', () => {
    test('lists every page of guardrails and filters by search', async () => {
        const pages = [
            {guardrails: [summary], nextToken: 'next'},
            {guardrails: [{...summary, id: 'zzz', name: 'other'}]},
        ]
        const {client, sent} = stubBedrock(() => pages.shift() as SendResult)
        const adapter = new AwsBedrockAdapter(client)

        const all = await adapter.list()
        expect(all.map((resource) => resource.name)).toEqual(['pii-filter', 'other'])
        expect(sent.every((command) => command instanceof ListGuardrailsCommand)).toBe(true)
        expect(all[0]).toMatchObject({id: 'abc123def456', type: 'guardrail', status: 'READY', metadata: {arn: ARN, version: 'DRAFT'}})

        pages.push({guardrails: [summary, {...summary, id: 'zzz', name: 'other'}]})
        expect((await adapter.list({search: 'PII'})).map((resource) => resource.id)).toEqual(['abc123def456'])
    })

    test('inspects a guardrail with its messages and policies', async () => {
        const {client, sent} = stubBedrock(() => ({
            guardrailId: summary.id,
            guardrailArn: ARN,
            name: summary.name,
            status: 'READY',
            version: 'DRAFT',
            blockedInputMessaging: 'no',
            blockedOutputsMessaging: 'no',
            contentPolicy: {filters: [{type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH'}]},
            createdAt: summary.createdAt,
        }))
        const resource = await new AwsBedrockAdapter(client).get('abc123def456')

        expect(sent[0]).toBeInstanceOf(GetGuardrailCommand)
        expect((sent[0] as GetGuardrailCommand).input).toEqual({guardrailIdentifier: 'abc123def456'})
        expect(resource?.metadata.blockedInputMessaging).toBe('no')
        expect(resource?.metadata.contentPolicy).toEqual({filters: [{type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH'}]})
        expect(resource?.metadata.topicPolicy).toBeNull()
    })

    test('answers null for a guardrail that does not exist', async () => {
        const {client} = stubBedrock(() => {
            throw Object.assign(new Error('not found'), {name: 'ResourceNotFoundException', $metadata: {httpStatusCode: 404}})
        })
        expect(await new AwsBedrockAdapter(client).get('missing')).toBeNull()
    })

    test('creates a guardrail and returns the stored resource', async () => {
        const {client, sent} = stubBedrock((command) => {
            if (command instanceof CreateGuardrailCommand) return {guardrailId: summary.id, guardrailArn: ARN, version: 'DRAFT'}
            return {guardrailId: summary.id, guardrailArn: ARN, name: 'pii-filter', status: 'READY', version: 'DRAFT'}
        })
        const created = await new AwsBedrockAdapter(client).create({
            values: {name: ' pii-filter ', blockedInputMessaging: 'x', blockedOutputsMessaging: 'y', description: ''},
        } as never)

        expect((sent[0] as CreateGuardrailCommand).input).toEqual({name: 'pii-filter', blockedInputMessaging: 'x', blockedOutputsMessaging: 'y'})
        expect(created.id).toBe(summary.id)
    })

    test('rejects a create without a name or messages', async () => {
        const {client, sent} = stubBedrock(() => ({}))
        const adapter = new AwsBedrockAdapter(client)
        await expect(adapter.create({values: {blockedInputMessaging: 'x', blockedOutputsMessaging: 'y'}} as never)).rejects.toBeInstanceOf(ValidationError)
        await expect(adapter.create({values: {name: 'n', blockedOutputsMessaging: 'y'}} as never)).rejects.toBeInstanceOf(ValidationError)
        expect(sent).toHaveLength(0)
    })

    test('deletes a guardrail by id', async () => {
        const {client, sent} = stubBedrock(() => ({}))
        await new AwsBedrockAdapter(client).delete('abc123def456')
        expect(sent[0]).toBeInstanceOf(DeleteGuardrailCommand)
        expect((sent[0] as DeleteGuardrailCommand).input).toEqual({guardrailIdentifier: 'abc123def456'})
    })
})
