import {describe, expect, test} from 'bun:test'
import {GetFoundationModelCommand, ListFoundationModelsCommand, type BedrockClient} from '@aws-sdk/client-bedrock'
import {AwsBedrockModelsAdapter} from './AwsBedrockModelsAdapter'
import {NotSupportedError} from '../cloud-spi/errors'

type SendResult = Record<string, unknown>

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

const model = {
    modelArn: 'arn:aws:bedrock:eu-central-1::foundation-model/eu.anthropic.claude-sonnet-4-5-v1:0',
    modelId: 'eu.anthropic.claude-sonnet-4-5-v1:0',
    modelName: 'claude-sonnet-4-5-v1:0',
    providerName: 'Anthropic',
    inputModalities: ['TEXT'],
    outputModalities: ['TEXT'],
    responseStreamingSupported: true,
    inferenceTypesSupported: ['ON_DEMAND'],
    modelLifecycle: {status: 'ACTIVE'},
}

describe('AwsBedrockModelsAdapter', () => {
    test('lists the foundation models and filters by search', async () => {
        const {client, sent} = stubBedrock(() => ({
            modelSummaries: [model, {...model, modelId: 'amazon.nova-pro-v1:0', modelName: 'nova-pro-v1:0', providerName: 'Amazon'}],
        }))
        const adapter = new AwsBedrockModelsAdapter(client)

        const all = await adapter.list()
        expect(all.map((resource) => resource.id)).toEqual(['eu.anthropic.claude-sonnet-4-5-v1:0', 'amazon.nova-pro-v1:0'])
        expect(all[0]).toMatchObject({type: 'foundation-model', service: 'bedrockModels', status: 'ACTIVE', metadata: {providerName: 'Anthropic'}})
        expect(sent[0]).toBeInstanceOf(ListFoundationModelsCommand)

        expect((await adapter.list({search: 'NOVA'})).map((resource) => resource.id)).toEqual(['amazon.nova-pro-v1:0'])
    })

    test('returns an empty list when nothing is mapped', async () => {
        const {client} = stubBedrock(() => ({modelSummaries: []}))
        expect(await new AwsBedrockModelsAdapter(client).list()).toEqual([])
    })

    test('inspects a model and maps a missing one to null', async () => {
        const {client, sent} = stubBedrock((command) => {
            if (command instanceof GetFoundationModelCommand && command.input.modelIdentifier === model.modelId) {
                return {modelDetails: model}
            }
            throw Object.assign(new Error('missing'), {name: 'ResourceNotFoundException', $metadata: {httpStatusCode: 404}})
        })
        const adapter = new AwsBedrockModelsAdapter(client)

        expect(await adapter.get(model.modelId)).toMatchObject({id: model.modelId, metadata: {arn: model.modelArn}})
        expect(await adapter.get('nope')).toBeNull()
        expect(sent).toHaveLength(2)
    })

    test('is read-only', async () => {
        const adapter = new AwsBedrockModelsAdapter(stubBedrock(() => ({})).client)
        await expect(adapter.create()).rejects.toBeInstanceOf(NotSupportedError)
        await expect(adapter.delete()).rejects.toBeInstanceOf(NotSupportedError)
    })
})
