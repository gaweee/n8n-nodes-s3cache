import { type INodeType, type INodeTypeDescription } from 'n8n-workflow';

export class S3cacheStore implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'S3cache Store',
		name: 's3cacheStore',
		icon: 'file:s3cache.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["cacheId"] || ""}}',
		description: 'Store cache entries in S3-backed storage',
		defaults: {
			name: 'S3cache Store',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 's3', required: true }],
		properties: [
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
				description: 'How long the cached data should remain valid when storing a value',
			},
		],
	};
}
