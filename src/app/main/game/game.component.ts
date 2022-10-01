import { Component, OnInit } from '@angular/core';
import { Tile } from 'src/app/shared/models/tile.model';

import { cloneDeep } from 'lodash';
import { shuffle } from 'src/app/core/utils/shuffle.util';
import { interval } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Router } from '@angular/router';

import { Howl, Howler } from 'howler';
import { LeaderboardService } from 'src/app/core/services/leaderboards.service';
import { Leaderboard } from 'src/app/shared/models/leaderboard.model';
import { DocumentReference } from '@angular/fire/firestore';

@Component({
  selector: 'wm-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit {
  tiles: Tile[] = [];
  distractionTiles: Tile[] = [];
  neededTiles: Tile[] = [];
  row1: Tile[] = [];
  row2: Tile[] = [];
  row3: Tile[] = [];

  time: number = 0;

  tile1: Tile;
  tile2: Tile;

  tilesMatch: number = 0;

  leaderboards: Leaderboard[] = [];

  constructor(
    private router: Router,
    private leaderboardService: LeaderboardService
  ) {}

  ngOnInit() {
    if (!localStorage.getItem('name')) {
      this.router.navigate(['/']);
    }
    this.time = 0;
    this.initTiles();
    this.getLeaderboards();
    this.tilesMatch = 0;
    setTimeout(() => {
      this.startTimeInterval();
    }, 2500);
  }

  addClassDelay(element, classes: string[], delay: number) {
    setTimeout(() => {
      element.classList.add(classes);
    }, delay);
  }

  async openTile(tile: Tile) {
    if (!this.tile2) {
      tile.opened = true;

      if (!this.tile1) {
        this.tile1 = tile;
      } else {
        if (this.tile1.index != tile.index) {
          this.tile2 = tile;
          if (this.tile1.imagePath === tile.imagePath) {
            this.tile1.opened = true;
            tile.isEffects = tile.matched = this.tile1.matched = true;
            this.tile1 = this.tile2 = null;

            const matchTile = this.neededTiles.find(
              (t) => t.imagePath === tile.imagePath
            );
            matchTile.matched = true;

            this.tilesMatch++;
            const sound = new Howl({
              src: ['/assets/sounds/match.wav'],
            });

            sound.play();

            if (this.tilesMatch >= 5) {
              let top = -1;
              top =
                this.leaderboards.length > 0
                  ? this.leaderboards.findIndex(
                      (leaderboard) => this.time <= leaderboard.time
                    )
                  : 1;
              top =
                this.leaderboards.length < 5 && top === -1
                  ? this.leaderboards.length + 1
                  : top;

              let leaderboard: DocumentReference = null;
              if (top != -1) {
                leaderboard = await this.leaderboardService.create({
                  name: localStorage.getItem('name'),
                  time: this.time,
                  rank: top + 1,
                });
              } else {
                leaderboard = await this.leaderboardService.create({
                  name: localStorage.getItem('name'),
                  time: this.time,
                });
              }

              setTimeout(() => {
                if (top != -1) {
                  localStorage.setItem('time', this.time.toString());
                  localStorage.setItem('rank', (top + 1).toString());
                  localStorage.setItem('leaderboard-id', leaderboard.id);
                  this.router.navigate(['/top-scorer']);
                } else {
                  localStorage.setItem('time', this.time.toString());
                  localStorage.setItem('leaderboard-id', leaderboard.id);
                  this.router.navigate(['/success']);
                }
              }, 2500);
            }
          } else {
            // const sound = new Howl({
            //   src: ['/assets/sounds/no-match.wav'],
            // });

            setTimeout(() => {
              this.tile1.opened = tile.opened = false;
              this.tile1 = this.tile2 = null;
            }, 1000);
          }
        }
      }
    }
  }

  private getLeaderboards() {
    this.leaderboardService.leaderboards$.subscribe(
      (leaderboards) => (this.leaderboards = leaderboards)
    );
  }

  private initTiles() {
    this.distractionTiles = Array(0)
      .fill(1)
      .map((n, i) => ({
        imagePath: `/assets/images/game-icons/1 (${i + 1}).png`,
        index: i,
        opened: false,
        matched: false,
        isLandscape: i + 1 >= 8,
        isEffects: false,
      }));

    this.neededTiles = Array(6)
      .fill(1)
      .map((n, i) => ({
        imagePath: `/assets/images/game-icons/1 (${i + 1}).png`,
        index: i,
        opened: false,
        matched: false,
        isLandscape: false,
        isEffects: false,
      }));

    this.tiles = [
      ...cloneDeep(this.neededTiles),
      ...cloneDeep(this.neededTiles),
    ];

    this.tiles = shuffle(this.tiles).map((tile, index) => ({ ...tile, index }));
    this.row1 = this.tiles.slice(0, 6);
    this.row2 = this.tiles.slice(6, 12);
  }

  private startTimeInterval() {
    interval(10)
      .pipe(filter(() => this.time < 30 && this.tilesMatch < 5))
      .subscribe(async () => {
        this.time += 0.01;

        if (this.time >= 30) {
          let leaderboard = await this.leaderboardService.create({
            name: localStorage.getItem('name'),
            match: this.tilesMatch,
          });
          const sound = new Howl({
            src: ['/assets/sounds/timesup.mp3'],
          });

          sound.play();

          this.tiles = this.tiles.map((tile) => ({
            opened: true,
            ...tile,
          }));
          setTimeout(() => {
            localStorage.setItem('match', this.tilesMatch.toString());
            localStorage.setItem('leaderboard-id', leaderboard.id);
            this.router.navigate(['/game-over']);
          }, 2500);
        }
      });
  }
}
