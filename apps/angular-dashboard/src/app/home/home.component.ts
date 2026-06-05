import { Component } from '@angular/core';
import { resumeData } from '@repo/resume-data';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly skills = resumeData.technicalSkills;
  readonly experience = resumeData.experience;
}
