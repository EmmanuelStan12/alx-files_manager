import { v4 as uuidV4 } from 'uuid';
import path from 'path';
import mongoDBCore from 'mongodb/lib/core';
import Queue from 'bull/lib/queue';
import {
  mkdirSync,
  writeFileSync,
  statAsync,
  existsSync,
  realpathAsync,
} from 'fs';
import { contentType } from 'mime-types';
import dbClient from '../utils/db';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
const ROOT_FOLDER_ID = 0;
const MAX_FILES_PER_PAGE = 20;
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');

const isValidId = (id) => {
  const size = 24;
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  return true;
};
const fileQueue = new Queue('thumbnail generation');

export default class FilesController {
  static async postUpload(req, res) {
    const { user } = req;
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }

    const acceptedTypes = ['folder', 'file', 'image'];
    if (!type || !acceptedTypes.includes(type)) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }

    if (type !== 'folder' && !data) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }

    const filesCollection = await dbClient.filesCollection();
    if (parentId !== 0) {
      const parentFile = await filesCollection
        .findOne({
          _id: isValidId(parentId)
            ? new mongoDBCore.BSON.ObjectId(parentId)
            : NULL_ID,
        });
      if (!parentFile) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (parentFile.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }

    const userId = user._id;
    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'file' || type === 'image') {
      const filePath = path.join(FOLDER_PATH, uuidV4());

      if (!existsSync(filePath)) {
        mkdirSync(FOLDER_PATH, { recursive: true });
      }

      const fileData = Buffer.from(data, 'base64');
      writeFileSync(filePath, fileData);

      fileDocument.localPath = filePath;
    }

    const result = await filesCollection.insertOne(fileDocument);

    const fileId = result.insertedId.toString();
    if (type === 'image') {
      const jobName = `Image thumbnail [${userId}-${fileId}]`;
      fileQueue.add({ userId: userId.toString(), fileId, name: jobName });
    }
    res.status(201).json({
      id: result.insertedId,
      userId: userId.toString(),
      name,
      type,
      isPublic,
      parentId,
      localPath: fileDocument.localPath || undefined,
    });
  }

  static async getShow(req, res) {
    const { user } = req;
    const id = req.params ? req.params.id : NULL_ID;
    const userId = user._id.toString();
    const filesCollection = await dbClient.filesCollection();
    const file = await filesCollection.findOne({
      _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
      userId: new mongoDBCore.BSON.ObjectId(userId),
    });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === ROOT_FOLDER_ID.toString()
        ? 0 : file.parentId.toString(),
    });
  }

  static async getIndex(req, res) {
    const { user } = req;

    const parentId = req.query.parentId || ROOT_FOLDER_ID.toString();
    const page = /\d+/.test((req.query.page || '').toString())
      ? Number.parseInt(req.query.page, 10)
      : 0;
    const filesFilter = {
      userId: user._id,
      parentId: parentId === ROOT_FOLDER_ID.toString()
        ? parentId
        : new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID),
    };

    const filesCollection = await dbClient.filesCollection();
    const files = await filesCollection
      .aggregate([
        { $match: filesFilter },
        { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: {
              $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
            },
          },
        },
      ]);
    const result = await files.toArray();
    res.status(200).json(result);
  }

  static async putPublish(req, res) {
    const { user } = req;
    const { id } = req.params;
    const userId = user._id.toString();
    const fileFilter = {
      _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
      userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
    };
    const filesCollection = await dbClient.filesCollection();
    const file = await filesCollection.findOne(fileFilter);

    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await filesCollection
      .updateOne(fileFilter, { $set: { isPublic: true } });
    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId === ROOT_FOLDER_ID.toString()
        ? 0
        : file.parentId.toString(),
    });
  }

  static async putUnpublish(req, res) {
    const { user } = req;
    const { id } = req.params;
    const userId = user._id.toString();
    const fileFilter = {
      _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
      userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
    };
    const filesCollection = await dbClient.filesCollection();
    const file = await filesCollection.findOne(fileFilter);

    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await filesCollection
      .updateOne(fileFilter, { $set: { isPublic: false } });
    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId === ROOT_FOLDER_ID.toString()
        ? 0
        : file.parentId.toString(),
    });
  }

  static async getFile(req, res) {
    const { user } = req;
    const { id } = req.params;
    const size = req.query.size || null;
    const userId = user ? user._id.toString() : '';
    const fileFilter = {
      _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
    };
    const filesCollection = await dbClient.filesCollection();
    const file = await filesCollection.findOne(fileFilter);

    if (!file || (!file.isPublic && (file.userId.toString() !== userId))) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (file.type === 'folder') {
      res.status(400).json({ error: 'A folder doesn\'t have content' });
      return;
    }
    let filePath = file.localPath;
    if (size) {
      filePath = `${file.localPath}_${size}`;
    }
    if (existsSync(filePath)) {
      const fileInfo = await statAsync(filePath);
      if (!fileInfo.isFile()) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
    } else {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const absoluteFilePath = await realpathAsync(filePath);
    res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
    res.status(200).sendFile(absoluteFilePath);
  }
}
