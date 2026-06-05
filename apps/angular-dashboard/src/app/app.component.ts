import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { resumeData } from '@repo/resume-data';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly resume = signal(resumeData);
}
