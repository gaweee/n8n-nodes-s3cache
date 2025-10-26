import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class S3cacheAws implements ICredentialType {
	name = 's3cacheAws';
	displayName = 'S3cache Credentials';
	documentationUrl = 'https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html';
	icon: Icon = { light: 'file:s3cache.svg', dark: 'file:s3cache.dark.svg' };

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
	];
}
