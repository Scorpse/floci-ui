import {
    GetFoundationModelCommand,
    ListFoundationModelsCommand,
    type BedrockClient,
    type FoundationModelDetails,
    type FoundationModelSummary,
} from '@aws-sdk/client-bedrock'
import {awsBedrockModelsSchema} from '../cloud-spi/bedrockModelsSchema'
import {NotSupportedError} from '../cloud-spi/errors'
import type {CloudResource, CloudServiceAdapter, ResourceQuery, ServiceSchema} from '../cloud-spi/types'

/**
 * The foundation models the emulated Bedrock reports through ListFoundationModels (Floci serves
 * its model catalogue since upstream PR #7675). Read-only; it is the model picker for testing
 * Converse.
 */
export class AwsBedrockModelsAdapter implements CloudServiceAdapter {
    readonly cloud = 'aws' as const
    readonly service = 'bedrockModels' as const

    constructor(private readonly bedrock: BedrockClient) {}

    schema(): ServiceSchema {
        return awsBedrockModelsSchema()
    }

    async list(query: ResourceQuery = {}): Promise<CloudResource[]> {
        const response = await this.bedrock.send(new ListFoundationModelsCommand({}))
        const resources = (response.modelSummaries ?? []).map(modelResource)
        const search = query.search?.trim().toLowerCase()
        return search
            ? resources.filter((resource) => `${resource.id} ${resource.name}`.toLowerCase().includes(search))
            : resources
    }

    async get(id: string): Promise<CloudResource | null> {
        try {
            const response = await this.bedrock.send(new GetFoundationModelCommand({modelIdentifier: id}))
            return response.modelDetails ? modelResource(response.modelDetails) : null
        } catch (error) {
            if (isNotFound(error)) return null
            throw error
        }
    }

    async create(): Promise<CloudResource> {
        throw new NotSupportedError('Foundation models are read-only')
    }

    async delete(): Promise<void> {
        throw new NotSupportedError('Foundation models are read-only')
    }

    async health(): Promise<void> {
        await this.bedrock.send(new ListFoundationModelsCommand({}))
    }
}

function modelResource(model: FoundationModelSummary | FoundationModelDetails): CloudResource {
    return {
        id: model.modelId ?? '',
        name: model.modelName ?? model.modelId ?? '',
        cloud: 'aws',
        service: 'bedrockModels',
        type: 'foundation-model',
        region: null,
        createdAt: null,
        status: model.modelLifecycle?.status ?? null,
        metadata: {
            arn: model.modelArn ?? null,
            providerName: model.providerName ?? null,
            inputModalities: model.inputModalities ?? [],
            outputModalities: model.outputModalities ?? [],
            responseStreamingSupported: model.responseStreamingSupported ?? null,
            inferenceTypesSupported: model.inferenceTypesSupported ?? [],
        },
    }
}

function isNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const value = error as {name?: string; $metadata?: {httpStatusCode?: number}}
    return value.name === 'ResourceNotFoundException' || value.$metadata?.httpStatusCode === 404
}
