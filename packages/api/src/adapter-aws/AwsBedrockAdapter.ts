import {
    CreateGuardrailCommand,
    DeleteGuardrailCommand,
    GetGuardrailCommand,
    ListGuardrailsCommand,
    type BedrockClient,
    type GetGuardrailCommandOutput,
    type GuardrailSummary,
} from '@aws-sdk/client-bedrock'
import {awsBedrockSchema} from '../cloud-spi/bedrockSchema'
import {ValidationError} from '../cloud-spi/errors'
import type {CloudResource, CloudServiceAdapter, CreateResourceInput, ResourceQuery, ServiceSchema} from '../cloud-spi/types'

/**
 * Amazon Bedrock control plane as Floci emulates it: guardrails. Floci does not emulate
 * ListFoundationModels or ListInferenceProfiles, so no model list is offered here.
 */
export class AwsBedrockAdapter implements CloudServiceAdapter {
    readonly cloud = 'aws' as const
    readonly service = 'bedrock' as const

    constructor(private readonly bedrock: BedrockClient) {}

    schema(): ServiceSchema {
        return awsBedrockSchema()
    }

    async list(query: ResourceQuery = {}): Promise<CloudResource[]> {
        const summaries: GuardrailSummary[] = []
        let nextToken: string | undefined
        do {
            const response = await this.bedrock.send(new ListGuardrailsCommand({nextToken, maxResults: 100}))
            summaries.push(...(response.guardrails ?? []))
            nextToken = response.nextToken
        } while (nextToken)
        const search = query.search?.trim().toLowerCase()
        const resources = summaries.map(summaryResource)
        return search ? resources.filter((resource) => resource.name.toLowerCase().includes(search)) : resources
    }

    async get(id: string): Promise<CloudResource | null> {
        try {
            return detailResource(await this.bedrock.send(new GetGuardrailCommand({guardrailIdentifier: id})))
        } catch (error) {
            if (isNotFound(error)) return null
            throw error
        }
    }

    async create(input: CreateResourceInput): Promise<CloudResource> {
        const name = text(input.values.name)
        const blockedInputMessaging = text(input.values.blockedInputMessaging)
        const blockedOutputsMessaging = text(input.values.blockedOutputsMessaging)
        if (!name) throw new ValidationError('name is required')
        if (!blockedInputMessaging) throw new ValidationError('blockedInputMessaging is required')
        if (!blockedOutputsMessaging) throw new ValidationError('blockedOutputsMessaging is required')
        const description = text(input.values.description)
        const created = await this.bedrock.send(new CreateGuardrailCommand({
            name,
            blockedInputMessaging,
            blockedOutputsMessaging,
            ...(description ? {description} : {}),
        }))
        const id = created.guardrailId
        if (!id) throw new ValidationError('Floci did not return a guardrail id')
        return (await this.get(id)) ?? {
            id,
            name,
            cloud: 'aws',
            service: 'bedrock',
            type: 'guardrail',
            region: null,
            createdAt: null,
            status: 'READY',
            metadata: {arn: created.guardrailArn ?? null, version: created.version ?? 'DRAFT'},
        }
    }

    async delete(id: string): Promise<void> {
        await this.bedrock.send(new DeleteGuardrailCommand({guardrailIdentifier: id}))
    }

    async health(): Promise<void> {
        await this.bedrock.send(new ListGuardrailsCommand({maxResults: 1}))
    }
}

function summaryResource(guardrail: GuardrailSummary): CloudResource {
    return {
        id: guardrail.id ?? guardrail.name ?? '',
        name: guardrail.name ?? guardrail.id ?? '',
        cloud: 'aws',
        service: 'bedrock',
        type: 'guardrail',
        region: null,
        createdAt: dateString(guardrail.createdAt),
        status: guardrail.status ?? null,
        metadata: {
            arn: guardrail.arn ?? null,
            version: guardrail.version ?? null,
            description: guardrail.description ?? null,
            updatedAt: dateString(guardrail.updatedAt),
        },
    }
}

function detailResource(guardrail: GetGuardrailCommandOutput): CloudResource {
    return {
        id: guardrail.guardrailId ?? guardrail.name ?? '',
        name: guardrail.name ?? guardrail.guardrailId ?? '',
        cloud: 'aws',
        service: 'bedrock',
        type: 'guardrail',
        region: null,
        createdAt: dateString(guardrail.createdAt),
        status: guardrail.status ?? null,
        metadata: {
            arn: guardrail.guardrailArn ?? null,
            version: guardrail.version ?? null,
            description: guardrail.description ?? null,
            updatedAt: dateString(guardrail.updatedAt),
            blockedInputMessaging: guardrail.blockedInputMessaging ?? null,
            blockedOutputsMessaging: guardrail.blockedOutputsMessaging ?? null,
            topicPolicy: guardrail.topicPolicy ?? null,
            contentPolicy: guardrail.contentPolicy ?? null,
            wordPolicy: guardrail.wordPolicy ?? null,
            sensitiveInformationPolicy: guardrail.sensitiveInformationPolicy ?? null,
        },
    }
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function dateString(value: Date | string | undefined): string | null {
    if (!value) return null
    return value instanceof Date ? value.toISOString() : value
}

function isNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const value = error as {name?: string; $metadata?: {httpStatusCode?: number}}
    return value.name === 'ResourceNotFoundException' || value.$metadata?.httpStatusCode === 404
}
