// news-image-20261126 — "THE WORLD TODAY", Thursday 26 November 2026.
// A one-page newspaper broadsheet drawn from scratch in pure Node stdlib.
// No network, no dependencies, no font files: the text is set in a 5x7
// bitmap font embedded below (the default font is the only font), and the
// PNG is encoded by hand (zlib deflate + CRC32). Output is deterministic:
// the same bytes on every run. Writes entry.png to MAKEFUN_OUTPUT_DIR
// (default "out" locally, /output in the grader sandbox).
//
// Content: 30 real stories from the reporting of Thursday 26 November 2026
// (Reuters, AP, CNN, BBC, USA TODAY and others), led by the first-ever
// weather postponement of the 100th Macy's Thanksgiving Day Parade.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [247, 242, 231];
const INK: [number, number, number] = [26, 26, 26];
const RED: [number, number, number] = [176, 42, 42];
const BLUE: [number, number, number] = [31, 78, 121];
const GOLD: [number, number, number] = [168, 124, 30];
const GREY: [number, number, number] = [96, 92, 84];
const LIGHT: [number, number, number] = [232, 226, 210];
const WHITE: [number, number, number] = [255, 255, 255];
const SKY: [number, number, number] = [58, 84, 112];
const SKY2: [number, number, number] = [84, 112, 140];
const RAIN: [number, number, number] = [170, 196, 216];
const BALLOON: [number, number, number] = [196, 52, 44];
const DARK: [number, number, number] = [40, 48, 58];
const WINDOW: [number, number, number] = [240, 200, 90];

type RGB = [number, number, number];
const px = new Uint8Array(W * H * 3);
function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, t, h, c);
}
function rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  hline(x, y, w, c, t);
  hline(x, y + h - t, w, c, t);
  vline(x, y, h, c, t);
  vline(x + w - t, y, h, c, t);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = -ry; y <= ry; y++) {
    const span = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    for (let x = -span; x <= span; x++) setPx(cx + x, cy + y, c);
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  fillEllipse(cx, cy, r, r, c);
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) / (by - ay)) * (bx - ax)));
      }
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs);
      const b = Math.max(...xs);
      for (let x = a; x <= b; x++) setPx(x, y, c);
    }
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Rows are 5 chars wide; '#' is ink, '.' is blank. Uppercase + digits +
// punctuation only; all copy is uppercased before drawing, so this is the
// one and only font — no external font file is ever loaded.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  ":": [".....", ".##..", ".....", ".....", ".....", ".##..", "....."],
  ";": [".....", ".##..", ".....", ".....", ".##..", "..#..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
};
const CHAR_ADV = 6; // 5 px glyph + 1 px gap, before scaling
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === "#") fillRect(x + col * scale, y + r * scale, scale, scale, c);
}
function textWidth(s: string, scale: number): number {
  return s.length * CHAR_ADV * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) drawChar(x + i * CHAR_ADV * scale, y, up[i], scale, c);
}
function drawTextCentred(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Greedy word wrap; returns the lines.
function wrap(s: string, scale: number, maxW: number): string[] {
  const up = s.toUpperCase();
  const words = up.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, s: string, scale: number, maxW: number, c: RGB, lh: number): number {
  const lines = wrap(s, scale, maxW);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return lines.length * lh;
}

// ---------------------------------------------------------------- content
// 30 stories, all from the reporting of Thursday 26 November 2026
// (Reuters, AP, CNN, BBC, USA TODAY, The Times, ESPN/Chess.com, BCCI).
// Sections: WORLD, SPORT, AMERICAS, CULTURE, EUROPE & ASIA. The lead is
// the day's biggest story: the first weather postponement in the 100-year
// history of the Macy's Thanksgiving Day Parade.
interface Story {
  section: string;
  headline: string;
  deck: string;
}
const LEAD: Story = {
  section: "LEAD STORY - NEW YORK",
  headline: "MACY'S PARADE POSTPONED - FIRST TIME IN 100 YEARS",
  deck: "The 100th Thanksgiving Day Parade will step off on Saturday instead of Thursday, after forecasters warned of 60 mph gusts and coastal flooding. It is the first weather postponement in the parade's century.",
};
const COLS: { title: string; color: RGB; stories: Story[] }[] = [
  {
    title: "WORLD",
    color: RED,
    stories: [
      { section: "", headline: "NOR'EASTER HITS EAST COAST ON THANKSGIVING", deck: "Rain, 60 mph gusts and flooding hit the seaboard." },
      { section: "", headline: "KING TIDES FLOOD CALIFORNIA COAST", deck: "La Jolla sets a record tide of 8.11 feet." },
      { section: "", headline: "CAIRO TANKER FIRE KILLS AT LEAST 31", deck: "Dozens of cars charred; the toll is preliminary." },
      { section: "", headline: "COLOMBIA POLICE FREE 20 HOSTAGES", deck: "All captives rescued alive after a 17-hour siege." },
      { section: "", headline: "NORTH KOREA ORDERS SWISS OFFICE SHUT", deck: "Pyongyang acts in a row over sanctions." },
      { section: "", headline: "SIX DIE IN PLANE CRASH OFF MISSISSIPPI", deck: "Two children among the dead off the Gulf coast." },
    ],
  },
  {
    title: "SPORT",
    color: BLUE,
    stories: [
      { section: "", headline: "GUKESH-SINDAROV: GAME 2 A 20-MOVE DRAW", deck: "The title match stays level in Geneva." },
      { section: "", headline: "1,220 PLAYERS REGISTER FOR IPL AUCTION", deck: "A record field signs up for the 2027 auction." },
      { section: "", headline: "SOORYAVANSHI SMASHES 204 OFF 53 BALLS", deck: "The young Indian batter blitzes the UAE." },
      { section: "", headline: "TWO AUSSIES FIRST TO FINISH GTA VI", deck: "They finish the game in 58 hours." },
    ],
  },
  {
    title: "AMERICAS",
    color: RED,
    stories: [
      { section: "", headline: "US CONSUMER CONFIDENCE NEAR 2-YEAR HIGH", deck: "Americans grow more upbeat on the economy." },
      { section: "", headline: "US READIES NEW TARIFF PLAN", deck: "Washington prepares fresh global tariffs." },
      { section: "", headline: "TOP US LAWYER DODGES NVIDIA QUESTIONS", deck: "She sidesteps questions on the chip giant." },
      { section: "", headline: "VENEZUELA REVEALS $237.5BN PUBLIC DEBT", deck: "Caracas plans a historic restructuring." },
      { section: "", headline: "PETROBRAS UNVEILS $122BN INVESTMENT PLAN", deck: "Brazil's oil firm bets on energy expansion." },
      { section: "", headline: "COLOMBIA MARKS 10 YEARS OF PEACE DEAL", deck: "The UN warns unfinished commitments remain." },
      { section: "", headline: "CANADA HOLDS LINE ON INFLATION PLAN", deck: "Ottawa holds its line as energy shocks loom." },
      { section: "", headline: "EL SALVADOR SETS ASIDE $860M FOR YEAR-END", deck: "Debt financing covers spending to December." },
    ],
  },
  {
    title: "CULTURE",
    color: GOLD,
    stories: [
      { section: "", headline: "DURAN DURAN GUITARIST ANDY TAYLOR DIES AT 65", deck: "The 'Rio' riff-maker died on Monday, aged 65." },
      { section: "", headline: "RAMAYANA PASSES DAY 20 AT BOX OFFICE", deck: "The epic nears a second 1,000-crore milestone." },
    ],
  },
  {
    title: "EUROPE & ASIA",
    color: BLUE,
    stories: [
      { section: "", headline: "RUSSIA LOST NEARLY 500,000 IN UKRAINE WAR", deck: "Moscow's own toll nears half a million." },
      { section: "", headline: "UKRAINE HITS RUSSIAN AIR BASE, 5 JETS DAMAGED", deck: "Three MiG-31s and two Su-34s knocked out." },
      { section: "", headline: "MERZ: RUSSIA ESCALATING THREAT TO EUROPE", deck: "Berlin defends Ukraine aid and more defence." },
      { section: "", headline: "34 NATIONS URGE RUSSIA TO HALT RIOT GAS", deck: "They cite watchdog findings of tear gas use." },
      { section: "", headline: "ITALY REBUKES UKRAINE OVER LIBYA STRIKES", deck: "Rome warns Kyiv against widening the war." },
      { section: "", headline: "PAKISTAN'S FIRST ASTRONAUT FLIES TO TIANGONG", deck: "Muhammad Zeeshan Ali joins Shenzhou-24." },
      { section: "", headline: "XI GRAFT PROBE SHAKES SHANGHAI STAR", deck: "A probe into a rising official shakes Beijing." },
      { section: "", headline: "INDIA MARKS CONSTITUTION DAY", deck: "IITs add 6,000 seats in robotics and AI." },
      { section: "", headline: "INDIA ANNOUNCES RS 15,000 CRORE NEPAL AID", deck: "New Delhi pledges a major package for Nepal." },
    ],
  },
];

// Column plan: three columns. Col 1 = WORLD (6) + SPORT (4); col 2 =
// AMERICAS (8) + CULTURE (2); col 3 = EUROPE & ASIA (9). Total 30 stories
// including the lead.
const LAYOUT: { title: string; color: RGB; stories: Story[] }[][] = [
  [COLS[0], COLS[1]],
  [COLS[2], COLS[3]],
  [COLS[4]],
];

// ---------------------------------------------------------------- layout
fillAll(PAPER);
const M = 24; // page margin

// Masthead
drawTextCentred(W / 2, 16, "THE WORLD TODAY", 5, INK);
drawTextCentred(W / 2, 60, "THURSDAY 26 NOVEMBER 2026", 2, RED);
drawText(M, 62, "ONE DAY - ONE PAGE", 1, GREY);
const rightTag = "30 STORIES - 6 CONTINENTS";
drawText(W - M - textWidth(rightTag, 1), 62, rightTag, 1, GREY);
hline(M, 84, W - 2 * M, INK, 3);
hline(M, 90, W - 2 * M, INK, 1);

// Lead block: text left, storm illustration right
const LEAD_Y = 104;
const LEAD_W = 596;
const PIC_X = M + LEAD_W + 16; // 636
const PIC_W = W - M - PIC_X; // 364
const PIC_H = 268;
drawText(M, LEAD_Y, LEAD.section, 2, RED);
const leadHeadH = drawWrapped(M, LEAD_Y + 22, LEAD.headline, 3, LEAD_W, INK, 26);
let ly = LEAD_Y + 22 + leadHeadH + 8;
ly += drawWrapped(M, ly, LEAD.deck, 1, LEAD_W, INK, 10) + 10;
hline(M, ly, LEAD_W, INK, 1);
ly += 8;
ly += drawWrapped(M, ly, "PARADE MOVES TO SATURDAY 8:30 A.M. - BALLOONS GROUNDED ONLY ONCE BEFORE, IN 1971 - MAYOR MAMDANI TO MISS PARADE FOR FOOT SURGERY", 1, LEAD_W, GREY, 10);

// By the numbers: the day's figures, drawn from the stories above
const NUM_Y = 284;
rect(M, NUM_Y, LEAD_W, 94, INK, 1);
drawText(M + 8, NUM_Y + 7, "BY THE NUMBERS", 2, RED);
const NUMS: [string, string][] = [
  ["60 MPH", "PEAK GUSTS FORECAST IN NEW YORK"],
  ["250M", "AMERICANS IN THE STORM'S PATH"],
  ["8.11 FT", "RECORD HIGH TIDE AT LA JOLLA"],
  ["500,000", "RUSSIA'S WAR DEAD, ITS OWN COUNT"],
  ["1,220", "PLAYERS REGISTERED FOR IPL AUCTION"],
  ["6,000", "NEW IIT SEATS IN ROBOTICS AND AI"],
];
for (let i = 0; i < NUMS.length; i++) {
  const nx = M + 8 + (i % 2) * 300;
  const ny = NUM_Y + 30 + Math.floor(i / 2) * 20;
  drawText(nx, ny, NUMS[i][0], 1, RED);
  drawText(nx + textWidth(NUMS[i][0] + " ", 1), ny, NUMS[i][1], 1, INK);
}

// Storm illustration: a parade balloon fighting the nor'easter
fillRect(PIC_X, LEAD_Y, PIC_W, PIC_H, SKY);
fillEllipse(PIC_X + 70, LEAD_Y + 40, 90, 22, SKY2);
fillEllipse(PIC_X + 240, LEAD_Y + 26, 110, 24, SKY2);
fillEllipse(PIC_X + 300, LEAD_Y + 62, 80, 20, [70, 96, 124]);
// balloon
const BX = PIC_X + 182;
const BY = LEAD_Y + 128;
fillEllipse(BX, BY, 86, 62, BALLOON);
fillEllipse(BX - 30, BY - 28, 26, 14, [226, 96, 84]); // highlight on the balloon
for (let i = -2; i <= 2; i++) {
  // white vertical stripes, clipped by the ellipse outline via short spans
  const sx = BX + i * 30;
  for (let y = BY - 58; y <= BY + 58; y++) {
    const span = Math.floor(86 * Math.sqrt(Math.max(0, 1 - ((y - BY) * (y - BY)) / (62 * 62))));
    if (Math.abs(sx - BX) < span - 4) {
      for (let t = -3; t <= 3; t++) setPx(sx + t, y, WHITE);
    }
  }
}
fillEllipse(BX, BY - 62, 20, 10, BALLOON);
line(BX - 40, BY + 56, BX - 18, BY + 92, INK);
line(BX + 40, BY + 56, BX + 18, BY + 92, INK);
fillRect(BX - 20, BY + 92, 40, 22, [120, 84, 40]);
// rain
for (let i = 0; i < 46; i++) {
  const rx = PIC_X + ((i * 53) % (PIC_W - 10));
  const ry = LEAD_Y + ((i * 37) % (PIC_H - 30));
  line(rx, ry, rx - 6, ry + 14, RAIN);
}
// skyline
const baseY = LEAD_Y + PIC_H;
fillRect(PIC_X, baseY - 52, 60, 52, DARK);
fillRect(PIC_X + 72, baseY - 78, 52, 78, DARK);
fillRect(PIC_X + 136, baseY - 44, 66, 44, DARK);
fillRect(PIC_X + 214, baseY - 66, 56, 66, DARK);
fillRect(PIC_X + 282, baseY - 38, 82, 38, DARK);
for (let i = 0; i < 26; i++) {
  const wx = PIC_X + 8 + ((i * 47) % (PIC_W - 16));
  const wy = baseY - 70 + ((i * 29) % 56);
  fillRect(wx, wy, 5, 6, WINDOW);
}
// wind swirls
line(PIC_X + 12, LEAD_Y + 200, PIC_X + 60, LEAD_Y + 196, WHITE);
line(PIC_X + 60, LEAD_Y + 196, PIC_X + 96, LEAD_Y + 202, WHITE);
line(PIC_X + 290, LEAD_Y + 220, PIC_X + 330, LEAD_Y + 214, WHITE);
line(PIC_X + 330, LEAD_Y + 214, PIC_X + 356, LEAD_Y + 220, WHITE);
rect(PIC_X, LEAD_Y, PIC_W, PIC_H, INK, 2);
drawText(PIC_X + 8, baseY - 18, "NEW YORK - THE 100TH PARADE, GROUNDED BY WEATHER", 1, WHITE);

// Section columns
const COL_Y = 392;
const COL_H = 596;
const GUT = 16;
const colW = Math.floor((W - 2 * M - 2 * GUT) / 3);
hline(M, COL_Y - 8, W - 2 * M, INK, 2);
for (let c = 0; c < 3; c++) {
  const cx = M + c * (colW + GUT);
  let y = COL_Y;
  for (const sec of LAYOUT[c]) {
    // section header band
    fillRect(cx, y, colW, 24, sec.color);
    drawText(cx + 8, y + 5, sec.title, 2, WHITE);
    y += 24 + 6;
    for (const st of sec.stories) {
      const hh = drawWrapped(cx, y, st.headline, 2, colW, INK, 15);
      y += hh + 2;
      const dh = drawWrapped(cx, y, st.deck, 1, colW, GREY, 9);
      y += dh + 5;
      hline(cx, y, colW, LIGHT, 1);
      y += 5;
    }
    y += 4;
  }
  void y;
  void COL_H;
}

// Footer
hline(M, 996, W - 2 * M, INK, 1);
drawTextCentred(
  W / 2,
  1004,
  "SOURCES: REUTERS - AP - CNN - BBC - USA TODAY - THE TIMES - REPORTING OF 26 NOVEMBER 2026",
  1,
  GREY,
);

// ---------------------------------------------------------------- output
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
fs.mkdirSync(outDir, { recursive: true });
const png = encodePNG(W, H, px);
fs.writeFileSync(path.join(outDir, "entry.png"), png);
