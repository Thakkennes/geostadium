const Scoring = {
    BASE_SCORE: 5000,
    TIME_BONUS: 500,
    TIME_BONUS_THRESHOLD: 30,
    DISTANCE_PENALTY_PER_10M: 1,
    MAX_DISTANCE_PENALTY: 5000,

    HINT_PENALTIES: {
        country: 0.10,
        city: 0.15,
        capacity: 0.10,
        opened: 0.10
    },

    DIFFICULTY_MODIFIERS: {
        easy: {
            distanceMultiplier: 0.5,
            timeBonusThreshold: 60,
            maxHints: 4
        },
        medium: {
            distanceMultiplier: 1.0,
            timeBonusThreshold: 30,
            maxHints: 4
        },
        hard: {
            distanceMultiplier: 1.5,
            timeBonusThreshold: 20,
            maxHints: 2
        }
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

    calculateScore(guessLat, guessLng, actualLat, actualLng, timeSeconds, hintsUsed, difficulty = 'medium', perfectZoneRadius = 150) {
        const distance = this.calculateDistance(guessLat, guessLng, actualLat, actualLng);
        const difficultyMod = this.DIFFICULTY_MODIFIERS[difficulty];

        // If within perfect zone (stadium boundaries), no distance penalty
        const effectiveDistance = Math.max(0, distance - perfectZoneRadius);

        let distancePenalty = (effectiveDistance / 10) * this.DISTANCE_PENALTY_PER_10M * difficultyMod.distanceMultiplier;
        distancePenalty = Math.min(distancePenalty, this.MAX_DISTANCE_PENALTY);

        let timeBonus = 0;
        if (timeSeconds <= difficultyMod.timeBonusThreshold) {
            timeBonus = this.TIME_BONUS;
        }

        let hintMultiplier = 1.0;
        for (const hint of hintsUsed) {
            if (this.HINT_PENALTIES[hint]) {
                hintMultiplier -= this.HINT_PENALTIES[hint];
            }
        }
        hintMultiplier = Math.max(0, hintMultiplier);

        let score = (this.BASE_SCORE - distancePenalty + timeBonus) * hintMultiplier;
        score = Math.max(0, Math.round(score));

        return {
            score,
            distance,
            distancePenalty: Math.round(distancePenalty),
            timeBonus,
            hintMultiplier,
            breakdown: {
                base: this.BASE_SCORE,
                distanceLost: -Math.round(distancePenalty),
                timeGained: timeBonus,
                hintReduction: `${Math.round((1 - hintMultiplier) * 100)}%`
            }
        };
    },

    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        } else if (meters < 10000) {
            return `${(meters / 1000).toFixed(2)} km`;
        } else if (meters < 100000) {
            return `${(meters / 1000).toFixed(1)} km`;
        } else {
            return `${Math.round(meters / 1000)} km`;
        }
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scoring;
}
