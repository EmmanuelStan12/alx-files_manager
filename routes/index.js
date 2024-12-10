import AppController from '../controllers/AppController';
import UserController from '../controllers/UserController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';
import { xTokenAuthorization, basicAuthorization } from '../middlewares/auth';

const injectRoutes = (app) => {
  app.get('/status', AppController.getStatus);
  app.get('/stats', AppController.getStats);

  app.post('/users', UserController.postNew);
  app.get('/users/me', xTokenAuthorization, UserController.getMe);

  app.get('/connect', basicAuthorization, AuthController.getConnect);
  app.get('/disconnect', xTokenAuthorization, AuthController.getDisconnect);

  app.post('/files', xTokenAuthorization, FilesController.postUpload);
  app.get('/files/:id', xTokenAuthorization, FilesController.getShow);
  app.get('/files', xTokenAuthorization, FilesController.getIndex);
  app.put('/files/:id/publish', xTokenAuthorization, FilesController.putPublish);
  app.put('/files/:id/unpublish', xTokenAuthorization, FilesController.putUnpublish);
  app.get('/files/:id/data', FilesController.getFile);
}

export default injectRoutes;
