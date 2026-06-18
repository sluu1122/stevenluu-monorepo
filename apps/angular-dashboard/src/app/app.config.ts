import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // darkModeSelector: false — intentional; disables OS prefers-color-scheme dark variant for this demo
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } }),
  ],
};
