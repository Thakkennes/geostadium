class Game {
    constructor() {
        this.map = null;
        this.currentStadium = null;
        this.currentRound = 1;
        this.totalRounds = 5;
        this.totalScore = 0;
        this.roundResults = [];
        this.hintsUsed = [];
        this.usedStadiumIds = [];
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        this.guessPosition = null;
        this.league = 'all';
    }

    async init() {
        const params = new URLSearchParams(window.location.search);
        this.league = params.get('league') || 'all';
        this.totalRounds = parseInt(params.get('rounds') || '5', 10);

        const token = localStorage.getItem('mapbox_token');
        if (!token) {
            alert('Mapbox token not found. Please go back and enter your token.');
            window.location.href = '/';
            return;
        }

        document.getElementById('total-rounds').textContent = this.totalRounds;

        this.map = new GameMap('map', token);
        await this.map.init(this.league);

        this.map.onGuessPlaced = (lat, lng) => {
            this.guessPosition = { lat, lng };
            document.getElementById('confirm-guess').disabled = false;
        };

        this.setupEventListeners();
        this.setupHintButtons();

        await this.startRound();
    }

    setupEventListeners() {
        document.getElementById('confirm-guess').addEventListener('click', () => {
            this.submitGuess();
        });

        document.getElementById('skip-round').addEventListener('click', () => {
            this.skipRound();
        });

        document.getElementById('next-round').addEventListener('click', () => {
            this.nextRound();
        });

        document.getElementById('play-again').addEventListener('click', () => {
            window.location.reload();
        });
    }

    setupHintButtons() {
        const hintButtons = document.querySelectorAll('.hint-btn');

        hintButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!btn.classList.contains('revealed') && !btn.disabled) {
                    this.revealHint(btn);
                }
            });
        });
    }

    revealHint(btn) {
        const hintType = btn.dataset.hint;

        if (!this.currentStadium || !this.currentStadium.hints) return;

        let hintValue = this.currentStadium.hints[hintType];
        if (hintType === 'capacity') {
            hintValue = hintValue.toLocaleString();
        }

        const valueEl = btn.querySelector('.hint-value');
        valueEl.textContent = hintValue;

        btn.classList.add('revealed');
        this.hintsUsed.push(hintType);
    }

    async startRound() {
        this.hintsUsed = [];
        this.guessPosition = null;
        this.elapsedSeconds = 0;

        document.getElementById('confirm-guess').disabled = true;
        this.showGameControls();

        const hintButtons = document.querySelectorAll('.hint-btn');
        hintButtons.forEach(btn => {
            btn.classList.remove('revealed');
            btn.querySelector('.hint-value').textContent = '';
        });

        this.map.reset(this.league);

        document.getElementById('current-round').textContent = this.currentRound;
        document.getElementById('total-score').textContent = this.totalScore.toLocaleString();

        const excludeParam = this.usedStadiumIds.map(id => `exclude=${id}`).join('&');
        const url = `/api/stadium/random?league=${this.league}&${excludeParam}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch stadium');
            }
            this.currentStadium = await response.json();
            this.usedStadiumIds.push(this.currentStadium.id);

            document.getElementById('team-name').textContent = this.currentStadium.team;
            document.getElementById('league-badge').textContent = this.formatLeague(this.currentStadium.league);
            document.getElementById('sport-badge').textContent = this.currentStadium.sport.replace('_', ' ');

            this.startTimer();
        } catch (error) {
            console.error('Error starting round:', error);
            alert('Error loading stadium data. Please try again.');
        }
    }

    startTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds++;
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        document.getElementById('timer').textContent = Scoring.formatTime(this.elapsedSeconds);
    }

    submitGuess() {
        if (!this.guessPosition) return;

        this.stopTimer();

        const perfectZoneRadius = this.currentStadium.radius || 150;
        const result = Scoring.calculateScore(
            this.guessPosition.lat,
            this.guessPosition.lng,
            this.currentStadium.coordinates.lat,
            this.currentStadium.coordinates.lng,
            this.elapsedSeconds,
            this.hintsUsed,
            'medium',
            perfectZoneRadius
        );

        this.totalScore += result.score;
        this.roundResults.push({
            stadium: this.currentStadium.name,
            team: this.currentStadium.team,
            score: result.score,
            distance: result.distance,
            time: this.elapsedSeconds,
            hintsUsed: this.hintsUsed.length
        });

        this.map.showCorrectLocation(
            this.currentStadium.coordinates.lat,
            this.currentStadium.coordinates.lng
        );

        this.hideGameControls();
        this.showRoundResult(result);
    }

    skipRound() {
        this.stopTimer();

        this.roundResults.push({
            stadium: this.currentStadium.name,
            team: this.currentStadium.team,
            score: 0,
            distance: null,
            time: this.elapsedSeconds,
            hintsUsed: this.hintsUsed.length,
            skipped: true
        });

        this.map.showCorrectLocation(
            this.currentStadium.coordinates.lat,
            this.currentStadium.coordinates.lng
        );

        this.hideGameControls();
        this.showRoundResult({ score: 0, distance: null });
    }

    hideGameControls() {
        document.querySelector('.game-controls').style.display = 'none';
    }

    showGameControls() {
        document.querySelector('.game-controls').style.display = 'flex';
    }

    showRoundResult(result) {
        const overlay = document.getElementById('round-result');

        document.getElementById('result-stadium').textContent = this.currentStadium.name;
        document.getElementById('result-distance').textContent = result.distance !== null
            ? Scoring.formatDistance(result.distance)
            : 'Skipped';
        document.getElementById('result-time').textContent = Scoring.formatTime(this.elapsedSeconds);
        document.getElementById('result-score').textContent = result.score.toLocaleString();

        document.getElementById('result-title').textContent = result.distance !== null
            ? (result.score > 4000 ? 'Excellent!' : result.score > 2000 ? 'Good job!' : 'Round Complete')
            : 'Round Skipped';

        const nextBtn = document.getElementById('next-round');
        nextBtn.textContent = this.currentRound >= this.totalRounds ? 'See Results' : 'Next Round';

        overlay.classList.remove('hidden');
    }

    nextRound() {
        document.getElementById('round-result').classList.add('hidden');

        if (this.currentRound >= this.totalRounds) {
            this.endGame();
        } else {
            this.currentRound++;
            this.startRound();
        }
    }

    endGame() {
        this.saveHighScore();

        document.getElementById('final-score').textContent = this.totalScore.toLocaleString();

        const summaryEl = document.getElementById('game-summary');
        summaryEl.innerHTML = this.roundResults.map((r, i) => `
            <div class="round-summary">
                <span>Round ${i + 1}: ${r.team}</span>
                <span>${r.score.toLocaleString()} pts</span>
            </div>
        `).join('');

        document.getElementById('game-over').classList.remove('hidden');

        sessionStorage.setItem('game_results', JSON.stringify({
            totalScore: this.totalScore,
            rounds: this.roundResults
        }));
    }

    formatLeague(league) {
        const leagueMap = {
            'Triple-A West': 'AAA',
            'Triple-A East': 'AAA',
            'Double-A Central': 'AA',
            'Double-A South': 'AA',
            'Double-A Northeast': 'AA',
            'High-A Central': 'High-A',
            'High-A East': 'High-A',
            'High-A West': 'High-A',
            'Low-A East': 'Low-A',
            'Low-A Southeast': 'Low-A',
            'Arizona Fall League': 'AFL',
            'Spring Training': 'Spring',
            'Atlantic League': 'Atlantic',
            'American Association': 'Indy'
        };
        return leagueMap[league] || league;
    }

    saveHighScore() {
        const scores = JSON.parse(localStorage.getItem('high_scores') || '[]');

        scores.push({
            score: this.totalScore,
            rounds: this.totalRounds,
            league: this.league,
            date: new Date().toISOString()
        });

        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, 10);

        localStorage.setItem('high_scores', JSON.stringify(topScores));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});
