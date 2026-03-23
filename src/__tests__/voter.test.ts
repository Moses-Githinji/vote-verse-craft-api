import request from 'supertest';
import { app } from '../app';
import { Organization } from '../models/Organization';
import { Voter } from '../models/Voter';
import jwt from 'jsonwebtoken';

jest.mock('../models/Organization');
jest.mock('../models/Voter');

describe('Voter API', () => {
  let authToken: string;
  let organizationId = 'fake-org-id';

  beforeAll(() => {
    process.env.JWT_SECRET = 'test_secret';
    // Generate a fake admin token
    authToken = jwt.sign({
      id: 'admin-id',
      role: 'admin',
      organization: { id: organizationId, type: 'school' }
    }, process.env.JWT_SECRET);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a voter successfully', async () => {
    (Organization.findOne as jest.Mock).mockResolvedValue({ _id: organizationId, orgType: 'school' });
    (Voter.findOne as jest.Mock).mockResolvedValue(null);
    (Voter.create as jest.Mock).mockResolvedValue({
      _id: 'voter-id',
      name: 'Test Voter',
      authCredential: 'TEST001',
      stream: '10A',
      organizationId
    });

    const response = await request(app)
      .post('/api/v1/school/voters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Voter',
        authCredential: 'TEST001',
        stream: '10A'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.voter.name).toBe('Test Voter');
    expect(Voter.create).toHaveBeenCalledTimes(1);
  });

  it('should prevent duplicate auth credentials', async () => {
    (Organization.findOne as jest.Mock).mockResolvedValue({ _id: organizationId, orgType: 'school' });
    (Voter.findOne as jest.Mock).mockResolvedValue({ _id: 'existing-voter-id' });

    const response = await request(app)
      .post('/api/v1/school/voters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Voter',
        authCredential: 'TEST001'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Auth credential already exists');
    expect(Voter.create).not.toHaveBeenCalled();
  });
});
