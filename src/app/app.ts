import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Hero } from './components/hero/hero';
import { About } from './components/about/about';
import { Skills } from './components/skills/skills';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Hero, About, Skills],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
