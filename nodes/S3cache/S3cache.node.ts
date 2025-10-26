import { type INodeType, type INodeTypeDescription } from 'n8n-workflow';

export class S3cache implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'S3cache',
		name: 's3cache',
		icon: 'file:s3cache.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["cacheId"] || ""}}',
		description: 'Read and write cached objects backed by Amazon S3',
		defaults: {
			name: 'S3cache',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main', 'main'],
		outputNames: ['Hit', 'Miss'],
		credentials: [{ name: 's3', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Cache Check',
						value: 'cacheCheck',
						action: 'Verify whether a cache entry exists',
						description: 'Verify whether a cache entry exists',
					},
					{
						name: 'Cache Store',
						value: 'cacheStore',
						action: 'Store or update a cache entry',
						description: 'Store or update a cache entry',
					},
				],
				default: 'cacheCheck',
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
				displayOptions: {
					show: {
						operation: ['cacheStore'],
					},
				},
				description: 'How long the cached data should remain valid when storing a value',
			},
		],
	};
}
