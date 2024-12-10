import { v4 as uuidV4 } from 'uuid';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    const { user } = req;
    try {
      const token = uuidV4();
      const key = `auth_${token}`;
      await redisClient.set(key, user._id.toString(), 86400);

      return res.status(200).json({ token });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    await redisClient.del(key);
    return res.status(204).send();
  }
}
