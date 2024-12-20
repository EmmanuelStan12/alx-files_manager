import Queue from 'bull/lib/queue';
import sha1 from 'sha1';
import dbClient from '../utils/db';

const userQueue = new Queue('email sending');

export default class UserController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const userCollection = await dbClient.usersCollection();
    const user = await userCollection.findOne({ email });
    if (user) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const result = await userCollection
      .insertOne({ email, password: sha1(password) });

    const id = result.insertedId.toString();

    userQueue.add({ userId: id });
    res.status(201).json({ id, email });
  }

  static async getMe(req, res) {
    const { user } = req;
    return res.status(200).json({ id: user._id, email: user.email });
  }
}
