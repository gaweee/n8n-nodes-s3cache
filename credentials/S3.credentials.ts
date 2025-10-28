import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class S3 implements ICredentialType {
	name = 's3';
	displayName = 'S3 Credentials';
	documentationUrl = 'https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html';
	icon: Icon = 'file:s3cache.svg';

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://s3.amazonaws.com',
			url: '/',
		},
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'Secret Access Key',
			name: 'secretAccessKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
		},
		{
			displayName: 'S3 Region',
			name: 'region',
			type: 'string',
			default: 'us-east-1',
			description: 'AWS region where the S3 bucket lives',
		},
		{
			displayName: 'S3 Bucket Name',
			name: 'bucketName',
			type: 'string',
			required: true,
			default: '',
			description: 'Bucket used to store cached objects',
		},
		{
			displayName: 'Folder Name',
			name: 'folderName',
			type: 'string',
			required: true,
			default: '',
			description: 'Folder or prefix inside the bucket for cache data',
		},
		{
			displayName: 'Force Path-Style URLs',
			name: 'forcePathStyle',
			type: 'boolean',
			default: false,
			description:
				'Enable when your bucket name contains dots (TLS wildcard limitation), you target a custom S3-compatible endpoint, or you are running against a local S3 emulator that expects path-style URLs',
			hint: 'Turn this on for dotted bucket names, self-hosted MinIO/Spaces/etc., or local S3 mocks. Leave off for standard AWS buckets without dots.',
		},
	];
}
