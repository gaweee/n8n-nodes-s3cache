import { type INodeType, type INodeTypeDescription } from 'n8n-workflow';

export class S3cacheCheck implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'S3cache Check',
		name: 's3cacheCheck',
		icon: 'file:s3cache.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["cacheId"] || ""}}',
		description: 'Check whether a cache entry exists in S3-backed storage',
		defaults: {
			name: 'S3cache Check',
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
		],
	};
}
