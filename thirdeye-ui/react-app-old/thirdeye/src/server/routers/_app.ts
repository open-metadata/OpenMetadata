import { router } from '../trpc';
import { dashboardRouter } from './dashboard';
import { actionItemsRouter } from './actionItems';
import { authRouter } from './auth';
import { oauthRouter } from './oauth';
import { oauthLinkRouter } from './oauth.link';
import { userRouter } from './user';
import { techniquesRouter } from './techniques';
import { insightsRouter } from './insights';
import { adminUsersRouter } from './admin.users';

export const appRouter = router({
  dashboard: dashboardRouter,
  actionItems: actionItemsRouter,
  auth: authRouter,
  oauth: oauthRouter,
  oauthLink: oauthLinkRouter,
  user: userRouter,
  techniques: techniquesRouter,
  insights: insightsRouter,
  admin: router({
    users: adminUsersRouter
  })
});

export type AppRouter = typeof appRouter;
