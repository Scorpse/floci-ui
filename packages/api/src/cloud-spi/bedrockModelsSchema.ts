import type {CapabilitySchema, ResourceActionName, ServiceSchema, TableColumnSchema} from './types'

const resourceActions: CapabilitySchema<ResourceActionName>[] = [
    {name: 'list', label: 'List foundation models', enabled: true, status: 'available', runtimeRequired: true},
    {name: 'inspect', label: 'Inspect foundation model', enabled: true, status: 'available', runtimeRequired: true},
]

const columns: TableColumnSchema[] = [
    {name: 'id', label: 'Model ID'},
    {name: 'provider', label: 'Provider', path: 'metadata.providerName', emptyText: '—'},
    {name: 'status', label: 'Status', format: 'badge', emptyText: '—'},
    {name: 'streaming', label: 'Streaming', path: 'metadata.responseStreamingSupported', emptyText: '—'},
    {name: 'arn', label: 'ARN', path: 'metadata.arn', emptyText: '—'},
]

export function awsBedrockModelsSchema(): ServiceSchema {
    return {
        cloud: 'aws',
        service: 'bedrockModels',
        displayName: 'Bedrock models',
        fields: [],
        actions: ['list', 'inspect'],
        capabilities: {resourceActions},
        filters: [{name: 'search', label: 'Search', type: 'text', required: false}],
        columns,
    }
}
