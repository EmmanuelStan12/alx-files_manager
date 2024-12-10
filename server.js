import express from 'express';
import injectRoutes from './routes';

const app = express();

const injectMiddlewares = (app) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};

const startServer = () => {
  const PORT = process.env.PORT || 5000;
  injectMiddlewares(app);
  injectRoutes(app);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

export default app;
