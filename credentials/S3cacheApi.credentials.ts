import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class S3cacheApi implements ICredentialType {
	name = 's3cacheApi';

	displayName = 'S3cache API';

	icon: Icon = { light: 'file:s3cache.svg', dark: 'file:s3cache.dark.svg' };

	// Link to your community node's README
	documentationUrl = 'https://github.com/org/-s3cache?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			body: {
				token: '={{$credentials.accessToken}}',
			},
			qs: {
				token: '={{$credentials.accessToken}}',
			},
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.example.com/v2',
			url: '/v1/user',
		},
	};
}
