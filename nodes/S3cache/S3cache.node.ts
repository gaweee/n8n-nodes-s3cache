import { type INodeType, type INodeTypeDescription } from 'n8n-workflow';

export class S3cache implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'S3cache',
		name: 's3cache',
		icon: { light: 'file:s3cache.svg', dark: 'file:s3cache.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["cacheId"] || ""}}',
		description: 'Read and write cached objects backed by Amazon S3',
		defaults: {
			name: 'S3cache',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'aws', required: true }],
		properties: [
			{
				displayName: 'S3 Bucket Name',
				name: 'bucketName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the bucket where cache entries are stored',
			},
			{
				displayName: 'Cache ID',
				name: 'cacheId',
				type: 'string',
				required: true,
				default: '',
				description: 'Unique identifier used as the cache key',
			},
			{
				displayName: 'TTL (Seconds)',
				name: 'ttl',
				type: 'number',
				required: true,
				default: 300,
				typeOptions: {
					minValue: 1,
				},
				description: 'How long the cached data should remain valid',
			},
		],
	};
}
