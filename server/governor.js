export class Governor {
  constructor(budgetMs) {
    this.budget = budgetMs;
    this.level = 0;
    this.lastChange = 0;
    this.sum = 0;
    this.n = 0;
    this.avg = 0;
  }

  record(ms, now) {
    this.sum += ms;
    if (++this.n < 60) return false;
    this.avg = this.sum / this.n;
    this.sum = 0;
    this.n = 0;
    return this.evaluate(now);
  }

  evaluate(now) {
    const before = this.level;
    if (this.avg > this.budget * 0.84) this.level = 2;
    else if (this.avg > this.budget * 0.64 && this.level < 1) this.level = 1;
    else if (now - this.lastChange > 30_000) {
      if (this.level === 2 && this.avg < this.budget * 0.6) this.level = 1;
      else if (this.level === 1 && this.avg < this.budget * 0.4) this.level = 0;
    }
    if (this.level !== before) this.lastChange = now;
    return this.level !== before;
  }

  get playerEvery() { return this.level >= 1 ? 2 : 1; }
  get specEvery() { return this.level >= 1 ? 4 : 2; }
  get playerCap() { return [30, 20, 12][this.level]; }
  get joinsOpen() { return this.level < 2; }
}
