import { ApplicationConfig, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';
import { loadRuntimeConfig } from './runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    // darkModeSelector: false — intentional; disables OS prefers-color-scheme dark variant for this demo
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } }),
    provideAppInitializer(loadRuntimeConfig),
  ],
};
