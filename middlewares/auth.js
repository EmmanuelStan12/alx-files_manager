import sha1 from 'sha1';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export const basicAuthorization = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString();
  const [email, password] = credentials.split(':');

  if (!email || !password) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const userCollection = await dbClient.usersCollection();
    const user = await userCollection.findOne({ email, password: sha1(password) });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const xTokenAuthorization = async (req, res, next) => {
  const token = req.header('X-Token');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const userCollection = await dbClient.usersCollection();
    const user = await userCollection.findOne({ _id: new mongoDBCore.BSON.ObjectId(userId) });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
