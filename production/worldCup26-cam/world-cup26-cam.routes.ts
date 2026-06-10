import { Routes } from '@angular/router';
import { WorldCup26CamComponent } from './world-cup26-cam.component';
import { ROUTES } from './defines/defines';

export const WORLD_CUP26_CAM_ROUTES: Routes = [
  {
    path: '',
    component: WorldCup26CamComponent,
    children: [
      {
        path: '',
        redirectTo: ROUTES.HOME,
        pathMatch: 'full',
      },
      {
        path: ROUTES.HOME,
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: ROUTES.WALKTHROUGH,
        loadComponent: () =>
          import('./pages/walkthrough/walkthrough.component').then((m) => m.WalkthroughComponent),
      },
      {
        path: ROUTES.CAMERA,
        loadComponent: () =>
          import('./pages/camera/camera.component').then((m) => m.CameraComponent),
      },
      {
        path: ROUTES.RESULT,
        loadComponent: () =>
          import('./pages/result/result.component').then((m) => m.ResultComponent),
      },
      {
        path: '**',
        redirectTo: ROUTES.HOME,
      },
    ],
  },
];
