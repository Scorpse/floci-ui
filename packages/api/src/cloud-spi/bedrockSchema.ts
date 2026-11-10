import type {CapabilitySchema, FieldSchema, ResourceActionName, ServiceSchema, TableColumnSchema} from './types'

const bedrockResourceActions: CapabilitySchema<ResourceActionName>[] = [
    {name: 'list', label: 'List guardrails', enabled: true, status: 'available', runtimeRequired: true},
    {name: 'create', label: 'Create guardrail', enabled: true, status: 'available', runtimeRequired: true},
    {name: 'delete', label: 'Delete guardrail', enabled: true, status: 'available', runtimeRequired: true},
    {name: 'inspect', label: 'Inspect guardrail', enabled: true, status: 'available', runtimeRequired: true},
    {
        name: 'invoke',
        label: 'Test with Converse',
        enabled: false,
        status: 'coming_soon',
        reason: 'Floci emulates the Bedrock Runtime Converse API, but the generic invoke panel is currently Lambda-specific.',
        runtimeRequired: true,
    },
]

const fields: FieldSchema[] = [
    {
        name: 'name',
        label: 'Guardrail Name',
        type: 'text',
        required: true,
        description: 'Letters, digits and the characters - _ only.',
    },
    {
        name: 'description',
        label: 'Description',
        type: 'text',
        required: false,
    },
    {
        name: 'blockedInputMessaging',
        label: 'Blocked Input Message',
        type: 'text',
        required: true,
        defaultValue: 'Sorry, the model cannot answer this question.',
    },
    {
        name: 'blockedOutputsMessaging',
        label: 'Blocked Output Message',
        type: 'text',
        required: true,
        defaultValue: 'Sorry, the model cannot answer this question.',
    },
]

const columns: TableColumnSchema[] = [
    {name: 'name', label: 'Name'},
    {name: 'status', label: 'Status', format: 'badge', emptyText: '—'},
    {name: 'version', label: 'Version', path: 'metadata.version', emptyText: '—'},
    {name: 'createdAt', label: 'Created', format: 'relative', emptyText: '—'},
    {name: 'arn', label: 'ARN', path: 'metadata.arn', emptyText: '—'},
]

export function awsBedrockSchema(): ServiceSchema {
    return {
        cloud: 'aws',
        service: 'bedrock',
        displayName: 'Bedrock',
        fields,
        actions: ['list', 'create', 'delete', 'inspect'],
        capabilities: {resourceActions: bedrockResourceActions},
        filters: [{name: 'search', label: 'Search', type: 'text', required: false}],
        columns,
    }
}
