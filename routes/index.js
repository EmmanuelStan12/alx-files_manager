import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';
import { xTokenAuthorization, basicAuthorization } from '../middlewares/auth';

const injectRoutes = (app) => {
  app.get('/status', AppController.getStatus);
  app.get('/stats', AppController.getStats);

  app.post('/users', UsersController.postNew);
  app.get('/users/me', xTokenAuthorization, UsersController.getMe);

  app.get('/connect', basicAuthorization, AuthController.getConnect);
  app.get('/disconnect', xTokenAuthorization, AuthController.getDisconnect);

  app.post('/files', xTokenAuthorization, FilesController.postUpload);
  app.get('/files/:id', xTokenAuthorization, FilesController.getShow);
  app.get('/files', xTokenAuthorization, FilesController.getIndex);
  app.put('/files/:id/publish', xTokenAuthorization, FilesController.putPublish);
  app.put('/files/:id/unpublish', xTokenAuthorization, FilesController.putUnpublish);
  app.get('/files/:id/data', FilesController.getFile);
};

export default injectRoutes;
