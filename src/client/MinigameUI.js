// MinigameUI: Manages mounting, rendering, and interaction bindings for Roulette and Craps overlays
(function() {
  class MinigameUI {
    constructor(overlayEl, clientGame) {
      this.overlayEl = overlayEl;
      this.clientGame = clientGame;
      this.modalTitle = document.getElementById('minigame-title');
      this.modalBody = document.getElementById('minigame-content');
      this.closeBtn = document.getElementById('minigame-close-btn');

      this.activeGameType = null;
      this.activeTableId = null;

      // Betting state
      this.selectedChipValue = 5;
      this.currentBets = new Map(); // betKey -> amount

      // Roulette specific state
      this.wheelRotation = 0;
      this.isSpinning = false;

      // Craps specific state
      this.crapsPoint = null;
      this.crapsActiveBets = []; // Keep track of multi-roll bets on the table
      this.isRolling = false;

      // Bind close button
      this.closeBtn.addEventListener('click', () => this.close());

      // Bind debug panel toggle
      const debugToggle = document.getElementById('minigame-debug-toggle');
      const debugPane = document.getElementById('minigame-debug-pane');
      if (debugToggle && debugPane) {
        debugToggle.addEventListener('change', () => {
          if (debugToggle.checked) {
            debugPane.classList.remove('hidden');
          } else {
            debugPane.classList.add('hidden');
          }
        });
      }

      // Bind help panel toggle
      const helpBtn = document.getElementById('minigame-help-btn');
      const helpPane = document.getElementById('minigame-help-pane');
      const helpCloseBtn = document.getElementById('help-pane-close-btn');

      if (helpBtn && helpPane) {
        helpBtn.addEventListener('click', () => {
          helpPane.classList.toggle('hidden');
        });
      }
      if (helpCloseBtn && helpPane) {
        helpCloseBtn.addEventListener('click', () => {
          helpPane.classList.add('hidden');
        });
      }
    }

    populateHelpContent(gameType) {
      const contentEl = document.getElementById('minigame-help-content');
      if (!contentEl) return;

      if (gameType === 'roulette') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Click on chips below to select your bet size, then click on the roulette felt grid to place chips. You can place bets on single numbers, columns, dozens, colors, evens/odds, or low/high ranges. Click <strong>SPIN WHEEL</strong> to play.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Single Numbers (0-36): <strong>35 to 1</strong></li>
            <li>Dozens (1st 12, 2nd 12, 3rd 12) & Columns: <strong>2 to 1</strong></li>
            <li>Outside Bets (Red, Black, Even, Odd, 1-18, 19-36): <strong>1 to 1 (Even Money)</strong></li>
          </ul>
        `;
      } else if (gameType === 'craps') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Select chip value and click on board cells to place bets. In Come-Out roll (Point is OFF): rolling a 7/11 wins on Pass Line; 2/3/12 loses. Any other number sets the Point (ON). Roll that point again before a 7 to win. Click PLACE/BUY button to toggle bet types on points.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Pass Line / Don't Pass: <strong>1 to 1</strong></li>
            <li>Field (2,3,4,9,10,11,12): <strong>1 to 1</strong> (Pays <strong>2:1</strong> on 2; <strong>3:1</strong> on 12)</li>
            <li>Place Point Bets: 4/10 pays <strong>9:5</strong> | 5/9 pays <strong>7:5</strong> | 6/8 pays <strong>7:6</strong></li>
            <li>Buy Point Bets (true odds, 5% Vig fee upfront): 4/10 pays <strong>2:1</strong> | 5/9 pays <strong>3:2</strong> | 6/8 pays <strong>6:5</strong></li>
            <li>Props: Yo (11) pays <strong>15:1</strong> | Craps 3 pays <strong>15:1</strong> | Craps 2/12 pays <strong>30:1</strong> | Any 7 pays <strong>4:1</strong></li>
            <li>ATS Side Bets: Small (2,3,4,5,6) pays <strong>34:1</strong> | Big (8,9,10,11,12) pays <strong>34:1</strong> | All (2-12) pays <strong>174:1</strong></li>
          </ul>
        `;
      } else if (gameType === 'slots') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Select your bet size (5, 25, 100, 500) and click <strong>PULL LEVER</strong> to spin. If reels stop on matching symbols, you win!</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>3x 7️⃣ (Sevens): <strong>80 to 1</strong></li>
            <li>3x 💎 (Diamonds): <strong>40 to 1</strong></li>
            <li>3x 🔔 (Bells): <strong>20 to 1</strong></li>
            <li>3x Fruits (Cherries, Lemons, Oranges, Grapes): <strong>8 to 1</strong></li>
            <li>Any 2 Matching: <strong>1 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'blackjack' || gameType === 'elec_blackjack') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Select bet value and click <strong>DEAL</strong>. Choose <strong>HIT</strong> to draw a card, <strong>STAND</strong> to keep your hand, or <strong>DOUBLE</strong> to double your bet and draw exactly one card. Beat the dealer's score without exceeding 21.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Natural Blackjack (21 on deal): <strong>3 to 2</strong></li>
            <li>Standard Beat Dealer: <strong>1 to 1</strong></li>
            <li>Insurance / Push: <strong>Returned</strong></li>
          </ul>
        `;
      } else if (gameType === 'ride_the_bus') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Guess cards in a 4-step sequence: Red/Black, Higher/Lower, In/Outside, or exact Suit. Win/advance on correct guess, lose/drink on wrong guess. Cashout early to lock in profits.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Step 2 Cashout: <strong>1.5 to 1</strong></li>
            <li>Step 3 Cashout: <strong>3 to 1</strong></li>
            <li>Step 4 Cashout: <strong>6 to 1</strong></li>
            <li>Bus Completion (Step 4 Win): <strong>15 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'three_card_poker') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Place an Ante bet and click <strong>DEAL ANTE</strong>. View your 3 cards and click <strong>PLAY</strong> (places matching bet) or <strong>FOLD</strong> (forfeits ante). Dealer must qualify with Queen high or better to play.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Dealer does not qualify: <strong>Ante pays 1:1, Play pushes</strong></li>
            <li>Dealer qualifies & Player Wins: <strong>Ante pays 1:1, Play pays 1:1</strong></li>
            <li>Straight Flush: <strong>5 to 1 Ante Bonus</strong></li>
            <li>Three of a Kind: <strong>4 to 1 Ante Bonus</strong></li>
          </ul>
        `;
      } else if (gameType === 'baccarat' || gameType === 'elec_baccarat') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Place wagers on Player, Banker, or Tie. Cards are dealt to Player and Banker. Tens/faces count as 0, aces are 1. The score is the last digit of the card sum. Closest score to 9 wins.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Player Win: <strong>1 to 1</strong></li>
            <li>Banker Win: <strong>0.95 to 1</strong> (5% commission)</li>
            <li>Tie Win: <strong>8 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'texas_holdem') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Place an Ante bet to deal pocket cards. Click FLOP, TURN, and RIVER to reveal community cards. Beat the dealer's 5-card hand value to win.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Player Wins: <strong>1 to 1 on Ante & Play</strong></li>
            <li>Tie: <strong>Push</strong></li>
          </ul>
        `;
      } else if (gameType === 'pai_gow') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Deal 7 cards and split them into a 5-card High Hand and a 2-card Low Hand. Both hands must beat the dealer's respective hands to win.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Win Both Hands: <strong>1 to 1</strong> (5% commission)</li>
            <li>Split (Win One, Lose One): <strong>Push</strong></li>
          </ul>
        `;
      } else if (gameType === 'sic_bo' || gameType === 'elec_sic_bo') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Place bets on different sums or outcomes of rolling 3 dice. Click ROLL to shake and roll.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Small (4-10) / Big (11-17): <strong>1 to 1</strong></li>
            <li>Triple Any: <strong>30 to 1</strong> | Specific Triple: <strong>180 to 1</strong></li>
            <li>Specific Totals: Up to <strong>60 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'caribbean_stud') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Place Ante to deal. Fold (forfeit ante) or Play (place 2x Ante). Dealer must qualify with Ace-King or better to pay play bet.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Dealer does not qualify: <strong>Ante pays 1:1, Play pushes</strong></li>
            <li>Dealer qualifies & Player Wins: <strong>Ante pays 1:1, Play pays 1:1</strong></li>
          </ul>
        `;
      } else if (gameType === 'big_six') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Place bets on wheel slots: $1, $2, $5, $10, $20, Joker, or Logo. Click SPIN to turn the wheel.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Joker / Logo: <strong>40 to 1</strong></li>
            <li>$20 slot: <strong>20 to 1</strong> | $10 slot: <strong>10 to 1</strong></li>
            <li>$5 slot: <strong>5 to 1</strong> | $2 slot: <strong>2 to 1</strong> | $1 slot: <strong>1 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'let_it_ride') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">3 equal bets are placed. View 3 pocket cards. Pull or Let Ride bet 1, then pull or Let Ride bet 2. Payout determined by final 5 cards.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Pair of 10s or better: <strong>1 to 1</strong></li>
            <li>Straight / Flush / House: Up to <strong>50 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'red_dog') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Two cards are dealt. Consecutive is a Push, equal draws third (pays 11:1 on match). Otherwise, bet on if the 3rd card falls in between.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Spread 1: <strong>5 to 1</strong> | Spread 2: <strong>4 to 1</strong></li>
            <li>Spread 3: <strong>2 to 1</strong> | Spread 4+: <strong>1 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'spanish_21') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Play blackjack using a deck with all 10s removed. Player 21 always wins instantly.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Natural Blackjack: <strong>3 to 2</strong></li>
            <li>Beat Dealer: <strong>1 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'casino_war') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Draw 1 card. High card wins. If a tie occurs, surrender to lose half bet or go to War (matching bet) to draw again.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Standard Win: <strong>1 to 1</strong></li>
            <li>War Win: <strong>War bet pays 1:1, Ante pushes</strong></li>
          </ul>
        `;
      } else if (gameType === 'video_poker') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Standard Jacks or Better poker console. Click DEAL to get 5 cards, choose cards to HOLD, then click DRAW to replace rest.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>Royal Flush: <strong>250 to 1</strong></li>
            <li>Full House: <strong>9 to 1</strong> | Jacks or Better: <strong>1 to 1</strong></li>
          </ul>
        `;
      } else if (gameType === 'plinko') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Select your bet amount and click <strong>DROP BALL</strong>. The ball bounces off peg rows randomly and lands in a multiplier slot.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Multipliers:</div>
          <p style="margin:4px 0 0 0; text-align:center; font-weight:800; color:var(--accent-gold);">5x | 2x | 0.5x | 0.2x | 0x | 0.2x | 0.5x | 2x | 5x</p>
        `;
      } else if (gameType === 'lottery') {
        contentEl.innerHTML = `
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">How to Play:</div>
          <p style="margin:0 0 8px 0;">Pick exactly 5 numbers between 1 and 20. Click <strong>BUY TICKET</strong> to draw 5 winning numbers and check matching counts.</p>
          <div style="font-weight:700; margin-bottom:4px; color:#fff;">Payout Odds:</div>
          <ul style="margin:0; padding-left:16px;">
            <li>5 Matches: <strong>250 to 1</strong> | 4 Matches: <strong>15 to 1</strong></li>
            <li>3 Matches: <strong>4 to 1</strong> | 2 Matches: <strong>1 to 1 (Return)</strong></li>
          </ul>
        `;
      }
    }

    logDebug(msg, type = 'info') {
      const logEl = document.getElementById('minigame-debug-log');
      if (logEl) {
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? 'var(--accent-pink)' : (type === 'success' ? 'var(--accent-green)' : (type === 'warning' ? 'var(--accent-gold)' : 'var(--accent-blue)'));
        logEl.innerHTML += `<div style="margin-bottom:4px; line-height:1.4;">[${time}] <span style="color:${color}; font-weight:800;">[${type.toUpperCase()}]</span> ${msg}</div>`;
        logEl.parentNode.scrollTop = logEl.parentNode.scrollHeight;
      }
    }

    open(gameType, tableId) {
      this.activeGameType = gameType;
      this.activeTableId = tableId;
      this.currentBets.clear();
      this.selectedChipValue = 5;
      this.sessionProfit = 0; // Initialize session profit on open
      this.otherPlayersHands = new Map();
      
      this.overlayEl.classList.remove('hidden');
      this.updateBalance();

      // Clear debug log
      const logEl = document.getElementById('minigame-debug-log');
      if (logEl) logEl.innerHTML = '';
      this.logDebug(`Initialized game overlay for: "${gameType}" on table "${tableId}"`, 'info');

      // Populate rules content dynamically
      this.populateHelpContent(gameType);
      
      // Auto-hide help panel on open
      const helpPane = document.getElementById('minigame-help-pane');
      if (helpPane) helpPane.classList.add('hidden');

      if (gameType === 'roulette' || gameType === 'elec_roulette') {
        this.modalTitle.innerText = gameType === 'elec_roulette' ? "🎡 Electronic Roulette Station" : "🎡 Neon Roulette Table";
        this.renderRoulette(gameType === 'elec_roulette');
      } else if (gameType === 'craps' || gameType === 'bubble_craps') {
        this.modalTitle.innerText = gameType === 'bubble_craps' ? "🎲 Bubble Craps Station" : "🎲 High-Stakes Craps";
        this.renderCraps(gameType === 'bubble_craps');
      } else if (gameType === 'slots') {
        this.modalTitle.innerText = "🎰 Cosmic Slot Machine";
        this.renderSlots();
      } else if (gameType === 'minigame_machine') {
        this.modalTitle.innerText = "🕹️ Planet Micro-Arcade Cabinet";
        this.renderMinigameMachine();
      } else if (gameType === 'blackjack' || gameType === 'elec_blackjack') {
        this.modalTitle.innerText = gameType === 'elec_blackjack' ? "🃏 Electronic Blackjack Terminal" : "🃏 Classic Blackjack Table";
        this.renderBlackjack(gameType === 'elec_blackjack');
      } else if (gameType === 'ride_the_bus') {
        this.modalTitle.innerText = "🚌 Ride The Bus";
        this.renderRideTheBus();
      } else if (gameType === 'three_card_poker') {
        this.modalTitle.innerText = "👑 Three Card Poker Table";
        this.renderThreeCardPoker();
      } else if (gameType === 'baccarat' || gameType === 'elec_baccarat') {
        this.modalTitle.innerText = gameType === 'elec_baccarat' ? "🃏 Electronic Baccarat Terminal" : "🃏 VIP Baccarat Table";
        this.renderBaccarat(gameType === 'elec_baccarat');
      } else if (gameType === 'texas_holdem') {
        this.modalTitle.innerText = "🃏 Texas Hold'em Bonus";
        this.renderTexasHoldem();
      } else if (gameType === 'pai_gow') {
        this.modalTitle.innerText = "🃏 Pai Gow Poker";
        this.renderPaiGow();
      } else if (gameType === 'sic_bo' || gameType === 'elec_sic_bo') {
        this.modalTitle.innerText = gameType === 'elec_sic_bo' ? "🎲 Electronic Sic Bo Station" : "🎲 Traditional Sic Bo Table";
        this.renderSicBo(gameType === 'elec_sic_bo');
      } else if (gameType === 'caribbean_stud') {
        this.modalTitle.innerText = "🃏 Caribbean Stud Table";
        this.renderCaribbeanStud();
      } else if (gameType === 'big_six') {
        this.modalTitle.innerText = "🎡 Big Six Wheel of Fortune";
        this.renderBigSix();
      } else if (gameType === 'let_it_ride') {
        this.modalTitle.innerText = "🃏 Let It Ride Poker";
        this.renderLetItRide();
      } else if (gameType === 'red_dog') {
        this.modalTitle.innerText = "🃏 Red Dog Card Table";
        this.renderRedDog();
      } else if (gameType === 'spanish_21') {
        this.modalTitle.innerText = "🃏 Spanish 21 Table";
        this.renderSpanish21();
      } else if (gameType === 'casino_war') {
        this.modalTitle.innerText = "⚔️ Casino War High-Card";
        this.renderCasinoWar();
      } else if (gameType === 'video_poker') {
        this.modalTitle.innerText = "🕹️ Electronic Video Poker";
        this.renderVideoPoker();
      } else if (gameType === 'plinko') {
        this.modalTitle.innerText = "🕹️ Peg Plinko Arcade";
        this.renderPlinko();
      } else if (gameType === 'lottery') {
        this.modalTitle.innerText = "🕹️ Lottery Kiosk Console";
        this.renderLottery();
      }

      if (!this.modalBody.querySelector('[id$="-other-players-list"]') && gameType !== 'craps' && gameType !== 'bubble_craps') {
        const listElId = `${gameType}-other-players-list`;
        const layout = document.createElement('div');
        layout.className = 'card-game-layout';
        layout.style.display = 'flex';
        layout.style.gap = '16px';
        layout.style.width = '100%';
        layout.style.maxWidth = '850px';
        layout.style.margin = '0 auto';
        layout.style.fontFamily = "'Outfit', sans-serif";

        const mainContent = document.createElement('div');
        mainContent.className = 'card-game-main-content';
        mainContent.style.flex = '2';
        mainContent.style.width = '100%';

        while (this.modalBody.firstChild) {
          mainContent.appendChild(this.modalBody.firstChild);
        }

        const sidebar = document.createElement('div');
        sidebar.id = `${gameType}-other-players-panel`;
        sidebar.style.display = 'flex';
        sidebar.style.flexDirection = 'column';
        sidebar.style.gap = '10px';
        sidebar.style.flex = '1.1';
        sidebar.style.padding = '16px';
        sidebar.style.background = 'rgba(0,0,0,0.5)';
        sidebar.style.borderRadius = '12px';
        sidebar.style.border = '1px solid rgba(255,255,255,0.08)';
        sidebar.style.fontSize = '11px';
        sidebar.style.maxHeight = '420px';
        sidebar.style.overflowY = 'auto';
        sidebar.style.boxSizing = 'border-box';

        const header = document.createElement('div');
        header.style.fontWeight = 'bold';
        header.style.color = 'var(--accent-gold)';
        header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        header.style.paddingBottom = '6px';
        header.style.textAlign = 'center';
        header.innerText = '👥 PLAYERS AT TABLE';
        sidebar.appendChild(header);

        const list = document.createElement('div');
        list.id = listElId;
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '12px';
        list.style.marginTop = '6px';
        list.style.color = '#aaa';
        list.style.textAlign = 'center';
        list.innerText = 'No other players at this table';
        sidebar.appendChild(list);

        layout.appendChild(mainContent);
        layout.appendChild(sidebar);
        this.modalBody.appendChild(layout);
      }

      this.updateDealerStatus();
      this.updateOtherPlayers(this.clientGame.state);

      // Tell client player state is locked in minigame
      this.clientGame.isInMinigame = true;
    }

    updateDealerStatus() {
      const statusEl = document.getElementById('minigame-dealer-status');
      if (!statusEl) return;

      if (['slots', 'elec_roulette', 'elec_blackjack', 'bubble_craps', 'video_poker', 'elec_sic_bo', 'elec_baccarat', 'plinko', 'lottery'].includes(this.activeGameType)) {
        statusEl.style.display = 'none';
        return;
      }

      statusEl.style.display = 'inline-block';

      // Find active object in client state
      const obj = this.clientGame.state.grid.objects.find(o => o.id === this.activeTableId);
      // Check if a player is standing on the dealer slot
      let playerIsDealer = false;
      if (obj && obj.dealerSeat) {
        const dealerX = obj.gridX + obj.dealerSeat.rx;
        const dealerY = obj.gridY + obj.dealerSeat.ry;
        const players = this.clientGame.state.players || {};
        for (const pId in players) {
          const p = players[pId];
          if (p.gridX === dealerX && p.gridY === dealerY) {
            playerIsDealer = true;
            break;
          }
        }
      }

      if (playerIsDealer) {
        statusEl.innerText = "🤵 Dealer: Player (You!) (+20% Profit)";
        statusEl.style.background = 'rgba(57, 255, 20, 0.2)';
        statusEl.style.color = '#39ff14';
        statusEl.style.borderColor = 'rgba(57, 255, 20, 0.3)';
        return;
      }

      if (!obj || !obj.dealerSeat || obj.dealerSeat.employeeId === null) {
        statusEl.innerText = "⚠️ No Dealer";
        statusEl.style.background = 'rgba(255, 77, 77, 0.2)';
        statusEl.style.color = '#ff4d4d';
        statusEl.style.borderColor = 'rgba(255, 77, 77, 0.3)';
        return;
      }

      // Find dealer employee details
      const empId = obj.dealerSeat.employeeId;
      const dealer = this.clientGame.state.employees && this.clientGame.state.employees[empId];
      if (!dealer) {
        statusEl.innerText = "🤵 Staffing...";
        statusEl.style.background = 'rgba(255, 215, 0, 0.2)';
        statusEl.style.color = '#ffd700';
        statusEl.style.borderColor = 'rgba(255, 215, 0, 0.3)';
        return;
      }

      // Calculate satisfaction and efficiency modifier label
      const needs = dealer.needs || { thirst: 100, hunger: 100, bio: 100 };
      const avg = ((needs.thirst !== undefined ? needs.thirst : 100) + 
                   (needs.hunger !== undefined ? needs.hunger : 100) + 
                   (needs.bio !== undefined ? needs.bio : 100)) / 3;
      let label = "🤵 Dealer: OK";
      let color = '#00f0ff';
      let bg = 'rgba(0, 240, 255, 0.2)';
      let border = 'rgba(0, 240, 255, 0.3)';

      if (avg >= 75) {
        label = "🤵 Dealer: Happy (+20% Profit)";
        color = '#39ff14';
        bg = 'rgba(57, 255, 20, 0.2)';
        border = 'rgba(57, 255, 20, 0.3)';
      } else if (avg < 40) {
        label = "🤵 Dealer: Tired (-20% Profit)";
        color = '#ff4d4d';
        bg = 'rgba(255, 77, 77, 0.2)';
        border = 'rgba(255, 77, 77, 0.3)';
      }

      statusEl.innerText = label;
      statusEl.style.color = color;
      statusEl.style.background = bg;
      statusEl.style.borderColor = border;
    }

    close() {
      // Escape hatch: allow closing at any time to prevent locks, resetting animations safely
      this.isSpinning = false;
      this.isRolling = false;

      this.overlayEl.classList.add('hidden');
      this.modalBody.innerHTML = '';
      
      // Notify simulator we are leaving interaction
      this.clientGame.sendAction(window.Casino.Protocol.Commands.LEAVE_INTERACTION);
      
      this.clientGame.isInMinigame = false;
      this.activeGameType = null;
      this.activeTableId = null;
    }

    updateBalance() {
      const balValEl = document.getElementById('minigame-chips-val');
      if (balValEl) {
        balValEl.innerText = this.clientGame.chips.toLocaleString();
      }
      if (this.clientGame) {
        this.clientGame.updateHUD();
      }
    }

    // Helper to get total bets in current workspace
    getBetTotal() {
      let sum = 0;
      for (const amount of this.currentBets.values()) {
        sum += amount;
      }
      return sum;
    }

    /* ==========================================================================
       ROULETTE MINIGAME LAYOUT & INTERACTIVE LOGIC
       ========================================================================== */
    renderRoulette(isElectronic = false) {
      const statsBarHTML = isElectronic 
        ? `<div>Current Bet: <span id="roulette-total-bet-val" style="color:var(--accent-gold); font-weight:800;">0</span> / 100 Chips</div>`
        : `<div>Current Bet: <span id="roulette-total-bet-val" style="color:var(--accent-gold); font-weight:800;">0</span> Chips</div>`;

      const chipSelectorHTML = isElectronic
        ? `<div class="chip-selector">
            <div class="picker-chip active" data-value="5">5</div>
            <div class="picker-chip" data-value="10">10</div>
            <div class="picker-chip" data-value="25">25</div>
           </div>`
        : `<div class="chip-selector">
            <div class="picker-chip active" data-value="5">5</div>
            <div class="picker-chip" data-value="25">25</div>
            <div class="picker-chip" data-value="100">100</div>
            <div class="picker-chip" data-value="500">500</div>
           </div>`;

      this.modalBody.innerHTML = `
        <div class="roulette-container">
          <div class="roulette-left">
            <div class="wheel-wrapper">
              <div class="wheel-pointer"></div>
              <canvas id="roulette-wheel-canvas" class="wheel-canvas" width="240" height="240"></canvas>
            </div>
            <div class="roulette-result-display">
              <div id="roulette-number-box" class="result-number green">00</div>
            </div>
          </div>
          <div class="roulette-right">
            <div class="board-wrapper">
              <div class="roulette-board">
                <!-- Zero Cell -->
                <div class="board-cell green cell-zero" data-bet="num_0">0</div>
                
                <!-- Main Numbers 1-36 -->
                ${this.generateRouletteNumbersHTML()}
                
                <!-- 2 to 1 column bets -->
                <div class="board-cell cell-2to1" data-bet="num_col1">2:1</div>
                <div class="board-cell cell-2to1" data-bet="num_col2">2:1</div>
                <div class="board-cell cell-2to1" data-bet="num_col3">2:1</div>
                
                <!-- Dozen Bets -->
                <div class="board-cell cell-dozen" data-bet="dozen1">1st 12</div>
                <div class="board-cell cell-dozen" data-bet="dozen2">2nd 12</div>
                <div class="board-cell cell-dozen" data-bet="dozen3">3rd 12</div>
                
                <!-- Even/Odd Red/Black Outside Bets -->
                <div class="board-cell cell-evenodd" data-bet="low">1 to 18</div>
                <div class="board-cell cell-evenodd" data-bet="even">Even</div>
                <div class="board-cell cell-evenodd red" data-bet="red">Red</div>
                <div class="board-cell cell-evenodd black" data-bet="black">Black</div>
                <div class="board-cell cell-evenodd" data-bet="odd">Odd</div>
                <div class="board-cell cell-evenodd" data-bet="high">19 to 36</div>
              </div>
            </div>
            
            <div id="roulette-stats-bar" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
              ${statsBarHTML}
              <div>Session Profit: <span id="minigame-session-profit" style="font-weight:800; color:#ffffff;">0</span> Chips</div>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:var(--text-secondary);">
                <input type="checkbox" id="roulette-keep-bets-checkbox" style="accent-color:var(--accent-blue);" checked> Keep bets on board
              </label>
            </div>
            
            <div class="controls-wrapper">
              ${chipSelectorHTML}
              <div class="action-buttons">
                <button id="roulette-clear-btn" class="action-btn secondary">Clear Bets</button>
                <button id="roulette-spin-btn" class="action-btn primary">Spin Wheel</button>
              </div>
            </div>

            <div id="roulette-result-log" class="minigame-log-feed">
              <div class="log-line info">Place bets on the felt and click SPIN WHEEL. History will appear here.</div>
            </div>
          </div>
        </div>
      `;

      this.drawRouletteWheel(0);
      this.bindRouletteEvents(isElectronic);
    }

    generateRouletteNumbersHTML() {
      // Roulette numbers layout is 3 columns (rows of 3 cells each)
      // Bottom row: 1, 4, 7... Middle: 2, 5, 8... Top: 3, 6, 9...
      // Column order on felt:
      // Row 1 (Top): 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
      // Row 2 (Mid): 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
      // Row 3 (Bot): 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
      const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      let html = '';

      for (let row = 3; row >= 1; row--) {
        for (let col = 0; col < 12; col++) {
          const num = col * 3 + row;
          const colorClass = reds.includes(num) ? 'red' : 'black';
          html += `<div class="board-cell ${colorClass}" data-bet="num_${num}">${num}</div>`;
        }
      }
      return html;
    }

    drawRouletteWheel(offsetAngle) {
      const canvas = document.getElementById('roulette-wheel-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const r = canvas.width / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
      const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      const slice = (Math.PI * 2) / 37;

      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(offsetAngle);

      for (let i = 0; i < 37; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r - 8, i * slice, (i + 1) * slice);
        ctx.closePath();

        const num = numbers[i];
        if (num === 0) ctx.fillStyle = '#0f6c38';
        else if (reds.includes(num)) ctx.fillStyle = '#b31b1b';
        else ctx.fillStyle = '#111';
        ctx.fill();

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw numbers
        ctx.save();
        ctx.rotate(i * slice + slice / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(num.toString(), r - 16, 3);
        ctx.restore();
      }

      // Draw brass center spindle
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#daa520';
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    bindRouletteEvents(isElectronic = false) {
      const self = this;
      
      // Chip selector click handler
      const chips = this.modalBody.querySelectorAll('.picker-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          self.selectedChipValue = parseInt(this.dataset.value);
        });
      });

      // Board Cell click handler (place chips)
      const cells = this.modalBody.querySelectorAll('.board-cell');
      cells.forEach(cell => {
        cell.addEventListener('click', function() {
          if (self.isSpinning) return;
          
          const betKey = this.dataset.bet;
          
          // Check electronic limit
          const limit = isElectronic ? 100 : Infinity;
          const totalPlannedBet = self.getBetTotal() + self.selectedChipValue;
          if (totalPlannedBet > limit) {
            self.clientGame.showNotification(`Electronic terminal limit reached (Max: ${limit} chips)!`, "warning");
            return;
          }

          // Check player balance
          if (totalPlannedBet > self.clientGame.chips) {
            self.clientGame.showNotification("Insufficient Chips to place this bet!", "error");
            return;
          }

          const currentAmount = self.currentBets.get(betKey) || 0;
          const newAmount = currentAmount + self.selectedChipValue;
          self.currentBets.set(betKey, newAmount);

          // Update cell marker visually
          self.updateCellBetUI(this, newAmount);

          // Update total bet display
          const totalValEl = document.getElementById('roulette-total-bet-val');
          if (totalValEl) {
            totalValEl.innerText = self.getBetTotal().toLocaleString();
          }
        });
      });

      // Clear bets
      this.modalBody.querySelector('#roulette-clear-btn').addEventListener('click', () => {
        if (this.isSpinning) return;
        this.currentBets.clear();
        cells.forEach(cell => {
          const chip = cell.querySelector('.bet-chip');
          if (chip) chip.remove();
        });

        // Update display
        const totalValEl = document.getElementById('roulette-total-bet-val');
        if (totalValEl) {
          totalValEl.innerText = '0';
        }
      });

      // Spin Wheel action
      this.modalBody.querySelector('#roulette-spin-btn').addEventListener('click', () => {
        if (this.currentBets.size === 0) {
          this.clientGame.showNotification("Please place at least one bet first!", "info");
          return;
        }

        // Format bets list for server command
        const betsArray = [];
        for (const [type, amount] of this.currentBets.entries()) {
          betsArray.push({ type, amount });
        }

        this.isSpinning = true;
        window.Casino.SoundManager.playSpin();
        this.modalBody.querySelector('#roulette-spin-btn').disabled = true;
        this.modalBody.querySelector('#roulette-clear-btn').disabled = true;

        // Dispatch Play minigame command to GameSim
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: this.activeGameType,
          tableId: this.activeTableId,
          bets: betsArray
        });
      });
    }

    updateCellBetUI(cellEl, amount, isBuy = false) {
      let chipEl = cellEl.querySelector('.bet-chip');
      if (!chipEl) {
        chipEl = document.createElement('div');
        chipEl.className = 'bet-chip';
        cellEl.appendChild(chipEl);
      }
      if (isBuy || cellEl.dataset.bet.startsWith('buy_')) {
        chipEl.innerText = "B " + amount;
        chipEl.classList.add('buy-chip');
      } else {
        chipEl.innerText = amount;
        chipEl.classList.remove('buy-chip');
      }
    }

    // Handles the outcome of Roulette callback from server
    handleRoulettePayout(payload) {
      const winningNumber = payload.winningNumber;
      const winningColor = payload.winningColor;

      // Animate spinning local wheel
      const targetAngle = this.getAngleForNumber(winningNumber);
      const totalSpins = 4; // spin 4 times round
      const finalAngle = (Math.PI * 2 * totalSpins) + targetAngle;

      let startTime = null;
      const spinDuration = 5000; // 5 seconds spin animation
      const startAngle = this.wheelRotation;

      const animateWheel = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = (timestamp - startTime) / spinDuration;

        if (progress < 1) {
          // Deceleration curve (EaseOutQuad)
          const ease = 1 - (1 - progress) * (1 - progress);
          this.wheelRotation = startAngle + (finalAngle - startAngle) * ease;
          this.drawRouletteWheel(this.wheelRotation);
          requestAnimationFrame(animateWheel);
        } else {
          // Finish spinning
          this.wheelRotation = finalAngle % (Math.PI * 2);
          this.drawRouletteWheel(this.wheelRotation);
          this.isSpinning = false;
          
          // Display result box
          const numberBox = document.getElementById('roulette-number-box');
          if (numberBox) {
            numberBox.innerText = winningNumber;
            numberBox.className = `result-number ${winningColor}`;
          }

          // Trigger screen shake or audio notifications
          setTimeout(() => {
            const net = payload.netPayout;
            if (net > 0) {
              window.Casino.SoundManager.playWin();
              this.clientGame.showNotification(`🎉 Win! You won ${payload.totalWin} chips! (Net: +${net})`, "success");
            } else if (net < 0) {
              window.Casino.SoundManager.playLose();
              this.clientGame.showNotification(`😢 Loss. You lost ${Math.abs(net)} chips.`, "error");
            } else {
              this.clientGame.showNotification(`Push. Original bet returned.`, "info");
            }

            // Update session profit
            this.sessionProfit += net;
            const profitEl = document.getElementById('minigame-session-profit');
            if (profitEl) {
              profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
              profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
            }

            // Flash winning cells green
            const winCells = [];
            const winNumCell = this.modalBody.querySelector(`.board-cell[data-bet="num_${winningNumber}"]`);
            if (winNumCell) winCells.push(winNumCell);

            payload.details.forEach(d => {
              if (d.won) {
                const cell = this.modalBody.querySelector(`.board-cell[data-bet="${d.bet}"]`);
                if (cell) winCells.push(cell);
              }
            });

            winCells.forEach(c => c.classList.add('winning-flash'));
            setTimeout(() => {
              winCells.forEach(c => c.classList.remove('winning-flash'));
            }, 2000);

            // Log detailed results breakdown inside the scrolling feed
            const logEl = document.getElementById('roulette-result-log');
            if (logEl) {
              const spinText = winningNumber === 0 ? "Green 0" : `${winningColor.toUpperCase()} ${winningNumber}`;
              const netSign = net >= 0 ? `+${net}` : `${net}`;
              const lineClass = net > 0 ? 'win' : (net < 0 ? 'loss' : 'info');
              
              let logHtml = `<div class="log-line ${lineClass}"><strong>Result: ${spinText} (Net: ${netSign})</strong></div>`;
              payload.details.forEach(d => {
                const betAmount = this.currentBets.get(d.bet) || 0;
                if (d.won) {
                  logHtml += `<div class="log-line win"> &raquo; Bet '${d.bet.replace('num_','')}' (${betAmount}): WON (+${d.payout} Chips)</div>`;
                } else {
                  logHtml += `<div class="log-line loss"> &raquo; Bet '${d.bet.replace('num_','')}' (${betAmount}): LOST</div>`;
                }
              });
              
              logEl.innerHTML += logHtml;
              logEl.scrollTop = logEl.scrollHeight;
            }

            // Unlock buttons & reset board bets
            const spinBtn = document.getElementById('roulette-spin-btn');
            if (spinBtn) spinBtn.disabled = false;
            const clearBtn = document.getElementById('roulette-clear-btn');
            if (clearBtn) clearBtn.disabled = false;

            const keepBetsCheckbox = document.getElementById('roulette-keep-bets-checkbox');
            const shouldKeep = keepBetsCheckbox ? keepBetsCheckbox.checked : true;
            
            const totalBet = this.getBetTotal();
            const canRepeat = this.clientGame.chips >= totalBet;

            if (!shouldKeep || !canRepeat) {
              if (shouldKeep && !canRepeat) {
                this.clientGame.showNotification("Bets cleared: Insufficient Chips to repeat!", "error");
              }
              
              this.currentBets.clear();
              const cells = this.modalBody.querySelectorAll('.board-cell');
              cells.forEach(cell => {
                const chip = cell.querySelector('.bet-chip');
                if (chip) chip.remove();
              });
              
              const totalValEl = document.getElementById('roulette-total-bet-val');
              if (totalValEl) {
                totalValEl.innerText = '0';
              }
            } else {
              // Bets repeated, update display
              const totalValEl = document.getElementById('roulette-total-bet-val');
              if (totalValEl) {
                totalValEl.innerText = totalBet.toLocaleString();
              }
            }

            // Update balance displays
            this.updateBalance();
          }, 600);
        }
      };

      requestAnimationFrame(animateWheel);
    }

    getAngleForNumber(number) {
      const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
      const index = numbers.indexOf(number);
      const slice = (Math.PI * 2) / 37;
      // Angle points to top (-Math.PI / 2), and wheel spins counter-clockwise
      return (Math.PI * 2) - (index * slice) - (slice / 2) - (Math.PI / 2);
    }

    /* ==========================================================================
       CRAPS MINIGAME LAYOUT & INTERACTIVE LOGIC
       ========================================================================== */
    renderCraps(isElectronic = false) {
      // Query the replica state if we already have a point established on this table
      const crapsState = this.clientGame.state.crapsState || {};
      const simState = crapsState[this.activeTableId];
      this.crapsPoint = simState ? simState.point : null;
      this.crapsActiveBets = simState ? (simState.activeBets || []) : [];
      this.crapsRolledNumbers = simState ? (simState.rolledNumbers || []) : [];

      const statsBarHTML = isElectronic 
        ? `<div>Current Bet: <span id="craps-total-bet-val" style="color:var(--accent-gold); font-weight:800;">0</span> / 100 Chips</div>`
        : `<div>Current Bet: <span id="craps-total-bet-val" style="color:var(--accent-gold); font-weight:800;">0</span> Chips</div>`;

      const chipSelectorHTML = isElectronic
        ? `<div class="chip-selector">
            <div class="picker-chip active" data-value="5">5</div>
            <div class="picker-chip" data-value="10">10</div>
            <div class="picker-chip" data-value="25">25</div>
           </div>`
        : `<div class="chip-selector">
            <div class="picker-chip active" data-value="5">5</div>
            <div class="picker-chip" data-value="25">25</div>
            <div class="picker-chip" data-value="100">100</div>
            <div class="picker-chip" data-value="500">500</div>
           </div>`;

      const boardHTML = isElectronic
        ? `<div class="craps-board" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="craps-cell craps-dont-pass" data-bet="dont_pass" style="grid-column: span 2; padding: 12px;">Don't Pass</div>
            <div class="craps-cell craps-pass-line" data-bet="pass_line" style="grid-column: span 2; padding: 12px;">PASS LINE</div>
            <div class="craps-cell craps-field" data-bet="field" style="grid-column: span 2; padding: 12px;">FIELD (2, 3, 4, 9, 10, 11, 12)</div>
            <div class="craps-cell" data-bet="prop_yo11" style="padding: 10px;">Yo (11)</div>
            <div class="craps-cell" data-bet="prop_any7" style="padding: 10px;">Any 7</div>
           </div>`
        : `<div class="craps-board">
            <!-- Don't Pass Line (Left column) -->
            <div class="craps-cell craps-dont-pass" data-bet="dont_pass">Don't Pass</div>

            <!-- Numbers (4, 5, 6, 8, 9, 10) -->
            <div class="craps-number-place">
              <div class="craps-cell place-num" data-bet="place_4">4</div>
              <div class="craps-cell place-num" data-bet="place_5">5</div>
              <div class="craps-cell place-num" data-bet="place_6">6</div>
              <div class="craps-cell place-num" data-bet="place_8">8</div>
              <div class="craps-cell place-num" data-bet="place_9">9</div>
              <div class="craps-cell place-num" data-bet="place_10">10</div>
            </div>

            <!-- Proposition Bets (Right) -->
            <div class="craps-prop-bets">
              <div class="craps-cell" data-bet="prop_yo11">Yo (11)</div>
              <div class="craps-cell" data-bet="prop_craps3">Craps 3</div>
              <div class="craps-cell" data-bet="prop_craps2">Craps 2</div>
              <div class="craps-cell" data-bet="prop_craps12">Craps 12</div>
              <div class="craps-cell" data-bet="prop_any7">Any 7</div>
              <!-- ATS Side Bets -->
              <div class="craps-cell" data-bet="prop_small" style="background:rgba(255,215,0,0.05); border-color:var(--accent-gold); font-size:10px;">Small 2-6</div>
              <div class="craps-cell" data-bet="prop_big" style="background:rgba(255,215,0,0.05); border-color:var(--accent-gold); font-size:10px;">Big 8-12</div>
              <div class="craps-cell" data-bet="prop_all" style="grid-column: span 2; background:rgba(0,240,255,0.05); border-color:var(--accent-blue); font-size:10px;">ALL (2-12)</div>
            </div>

            <!-- Field bet (Mid row 3) -->
            <div class="craps-cell craps-field" data-bet="field">FIELD (2, 3, 4, 9, 10, 11, 12)</div>

            <!-- Pass Line (Bottom row 4) -->
            <div class="craps-cell craps-pass-line" data-bet="pass_line">PASS LINE</div>
          </div>`;

      this.modalBody.innerHTML = `
        <div class="craps-container">
          <div id="craps-other-players-inline" style="font-size: 11px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 6px 12px; margin-bottom: 8px; border-radius: 8px; display: none; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <span>👥 Other Players at Table:</span>
            <span id="craps-other-players-list-inline" style="color: var(--accent-gold); font-weight: bold;"></span>
          </div>
          <div class="craps-top">
            <div class="craps-status" style="align-items:center;">
              <div class="status-indicator" style="margin-right:12px;">Point: <span id="craps-point-display" class="status-value">OFF</span></div>
              <div class="ats-tracker" style="display:${isElectronic ? 'none' : 'flex'}; gap:4px; align-items:center;">
                <span style="font-size:11px; color:var(--text-secondary); margin-right:4px;">ATS History:</span>
                <span class="ats-num" data-num="2">2</span>
                <span class="ats-num" data-num="3">3</span>
                <span class="ats-num" data-num="4">4</span>
                <span class="ats-num" data-num="5">5</span>
                <span class="ats-num" data-num="6">6</span>
                <span style="color:var(--text-secondary); font-size:12px; margin:0 2px;">|</span>
                <span class="ats-num" data-num="8">8</span>
                <span class="ats-num" data-num="9">9</span>
                <span class="ats-num" data-num="10">10</span>
                <span class="ats-num" data-num="11">11</span>
                <span class="ats-num" data-num="12">12</span>
              </div>
            </div>
            <div class="dice-area">
              <div id="die1" class="die" data-val="1"><div class="die-dot"></div></div>
              <div id="die2" class="die" data-val="1"><div class="die-dot"></div></div>
            </div>
          </div>

          <div class="craps-board-wrapper">
            ${boardHTML}
          </div>

          <div id="craps-stats-bar" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
            ${statsBarHTML}
            <div>Session Profit: <span id="minigame-session-profit" style="font-weight:800; color:#ffffff;">0</span> Chips</div>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:var(--text-secondary);">
              <input type="checkbox" id="craps-keep-bets-checkbox" style="accent-color:var(--accent-blue);" checked> Keep bets on board
            </label>
          </div>

          <div class="controls-wrapper">
            ${chipSelectorHTML}
            <div class="action-buttons">
              <button id="craps-mode-btn" class="action-btn secondary" style="display:${isElectronic ? 'none' : 'block'}; border: 1px solid var(--accent-blue); color: var(--accent-blue); font-weight: 800; padding: 12px 18px;">PLACE MODE</button>
              <button id="craps-clear-btn" class="action-btn secondary">Clear Bets</button>
              <button id="craps-roll-btn" class="action-btn primary">Roll Dice</button>
            </div>
          </div>

          <div id="craps-result-log" class="minigame-log-feed">
            <div class="log-line info">Place bets on Pass Line, Don't Pass, or ATS and click ROLL DICE. Payout logs appear here.</div>
          </div>
        </div>
      `;

      this.bindCrapsEvents(isElectronic);
      this.reconstructActiveCrapsBetsUI();
      if (!isElectronic) {
        this.updateATSLights(this.crapsRolledNumbers);
        this.updateCrapsPucks(this.crapsPoint);
      }
    }

    bindCrapsEvents(isElectronic = false) {
      const self = this;
      self.crapsBetMode = 'PLACE';
      
      // Chip selector
      const chips = this.modalBody.querySelectorAll('.picker-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          self.selectedChipValue = parseInt(this.dataset.value);
        });
      });

      // Bet Mode Selector (PLACE vs BUY)
      const modeBtn = this.modalBody.querySelector('#craps-mode-btn');
      if (modeBtn) {
        modeBtn.addEventListener('click', () => {
          if (self.isRolling) return;
          if (self.crapsBetMode === 'PLACE') {
            self.crapsBetMode = 'BUY';
            modeBtn.innerText = 'BUY MODE';
            modeBtn.style.background = 'rgba(0, 240, 255, 0.1)';
            modeBtn.style.boxShadow = '0 0 10px rgba(0, 240, 255, 0.3)';
          } else {
            self.crapsBetMode = 'PLACE';
            modeBtn.innerText = 'PLACE MODE';
            modeBtn.style.background = 'none';
            modeBtn.style.boxShadow = 'none';
          }
        });
      }

      // Board grid cells click handlers
      const cells = this.modalBody.querySelectorAll('.craps-cell');
      cells.forEach(cell => {
        cell.addEventListener('click', function() {
          if (self.isRolling) return;
          
          let betKey = this.dataset.bet;
          if (!betKey) return;

          // Buy bet conversion
          if (betKey.startsWith('place_') && self.crapsBetMode === 'BUY') {
            betKey = betKey.replace('place_', 'buy_');
          }

          // Verify affordability (with 5% Vig for Buy bets)
          let plannedCost = self.selectedChipValue;
          if (betKey.startsWith('buy_')) {
            plannedCost += Math.max(1, Math.floor(self.selectedChipValue * 0.05));
          }

          // Electronic limit check
          const limit = isElectronic ? 100 : Infinity;
          const totalPlannedBet = self.getBetTotal() + plannedCost;
          if (totalPlannedBet > limit) {
            self.clientGame.showNotification(`Electronic terminal limit reached (Max: ${limit} chips)!`, "warning");
            return;
          }

          if (totalPlannedBet > self.clientGame.chips) {
            self.clientGame.showNotification("Insufficient Chips (plus 5% commission)!", "error");
            return;
          }

          const currentAmount = self.currentBets.get(betKey) || 0;
          const newAmount = currentAmount + self.selectedChipValue;
          self.currentBets.set(betKey, newAmount);

          self.logDebug(`Placed bet on "${betKey.replace('prop_','').replace('place_','').toUpperCase()}" for ${self.selectedChipValue} Chips (Cell total: ${newAmount})`, 'info');

          self.updateCellBetUI(this, newAmount, betKey.startsWith('buy_'));

          // Update total bet display
          const totalValEl = document.getElementById('craps-total-bet-val');
          if (totalValEl) {
            totalValEl.innerText = self.getBetTotal().toLocaleString();
          }
        });
      });

      // Clear bets (clears only new unplaced bets)
      this.modalBody.querySelector('#craps-clear-btn').addEventListener('click', () => {
        if (this.isRolling) return;
        this.currentBets.clear();
        cells.forEach(cell => {
          const betKey = cell.dataset.bet;
          const matchingActive = self.crapsActiveBets.find(b => b.type === betKey || (b.type.startsWith('buy_') && betKey === b.type.replace('buy_', 'place_')));
          
          if (!matchingActive) {
            const chip = cell.querySelector('.bet-chip');
            if (chip) chip.remove();
          } else {
            // Re-render server bet value
            self.updateCellBetUI(cell, matchingActive.amount, matchingActive.type.startsWith('buy_'));
          }
        });

        // Update total bet display
        const totalValEl = document.getElementById('craps-total-bet-val');
        if (totalValEl) {
          totalValEl.innerText = self.getBetTotal().toLocaleString();
        }
      });

      // Roll action
      this.modalBody.querySelector('#craps-roll-btn').addEventListener('click', () => {
        if (this.isRolling) return;

        // Check if there are active bets on the table, OR new bets being placed
        if (this.crapsActiveBets.length === 0 && this.currentBets.size === 0) {
          this.clientGame.showNotification("Please place a bet on Pass Line, Don't Pass, or another section!", "info");
          return;
        }

        const betsArray = [];
        for (const [type, amount] of this.currentBets.entries()) {
          betsArray.push({ type, amount });
        }

        self.logDebug(`Rolling dice... Submitting ${betsArray.length} resolved/new bets to server.`, 'info');

        this.isRolling = true;
        window.Casino.SoundManager.playDice();
        this.modalBody.querySelector('#craps-roll-btn').disabled = true;
        this.modalBody.querySelector('#craps-clear-btn').disabled = true;

        // Clear local currentBets as they are now committed to active table bets
        this.currentBets.clear();

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: this.activeGameType,
          tableId: this.activeTableId,
          action: 'roll',
          bets: betsArray
        });
      });
    }

    reconstructActiveCrapsBetsUI() {
      this.crapsActiveBets.forEach(bet => {
        const cell = this.modalBody.querySelector(`.craps-cell[data-bet="${bet.type}"]`);
        if (cell) {
          this.updateCellBetUI(cell, bet.amount);
        }
      });
    }

    // Handles the outcome of Craps callback from server
    handleCrapsPayout(payload) {
      const d1 = payload.die1;
      const d2 = payload.die2;
      const total = payload.total;
      const point = payload.point;

      const die1El = document.getElementById('die1');
      const die2El = document.getElementById('die2');

      // Shaking animation
      die1El.classList.add('rolling');
      die2El.classList.add('rolling');

      // Setup interval to cycle dice values while rolling
      let rollCycles = 0;
      const cycleInterval = setInterval(() => {
        die1El.dataset.val = Math.floor(Math.random() * 6) + 1;
        die2El.dataset.val = Math.floor(Math.random() * 6) + 1;
        
        // Re-generate dots
        this.renderDieDots(die1El);
        this.renderDieDots(die2El);

        rollCycles++;
        if (rollCycles >= 10) {
          clearInterval(cycleInterval);
          
          // Stop roll, set final values
          die1El.classList.remove('rolling');
          die2El.classList.remove('rolling');

          die1El.dataset.val = d1;
          die2El.dataset.val = d2;
          this.renderDieDots(die1El);
          this.renderDieDots(die2El);

          // Resolve payouts
          this.isRolling = false;
          this.crapsPoint = point;
          this.crapsActiveBets = payload.activeBets;

          // Update point pucks & ATS checked-off values
          this.updateATSLights(payload.rolledNumbers);
          this.updateCrapsPucks(point);

          // Trigger result alert
          setTimeout(() => {
            const win = payload.totalWin;
            const loss = payload.totalBetLoss;
            let statusType = 'info';
            let msg = `Dice roll: ${d1} + ${d2} = ${total}. `;
            
            if (win > 0 && loss > 0) {
              window.Casino.SoundManager.playWin();
              msg += `🎉 Won +${win}! (Lost -${loss})`;
              statusType = 'success';
            } else if (win > 0) {
              window.Casino.SoundManager.playWin();
              msg += `🎉 Won +${win} Chips!`;
              statusType = 'success';
            } else if (loss > 0) {
              window.Casino.SoundManager.playLose();
              msg += `😢 Lost -${loss} Chips.`;
              statusType = 'error';
            } else {
              msg += `Point is: ${point ? point : 'Resolved'}.`;
            }
            this.clientGame.showNotification(msg, statusType);

            // Update session profit
            const net = win - loss;
            this.sessionProfit += net;
            const profitEl = document.getElementById('minigame-session-profit');
            if (profitEl) {
              profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
              profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
            }

            // Log detailed results breakdown inside the scrolling feed
            const logEl = document.getElementById('craps-result-log');
            if (logEl) {
              const net = win - loss;
              const netSign = net >= 0 ? `+${net}` : `${net}`;
              const lineClass = net > 0 ? 'win' : (net < 0 ? 'loss' : 'info');
              
              let logHtml = `<div class="log-line ${lineClass}"><strong>Result: ${d1} + ${d2} = ${total} (Net: ${netSign})</strong></div>`;
              payload.payoutDetails.forEach(d => {
                const betName = d.type.replace('prop_','').replace('place_','').replace('buy_','');
                if (d.isPush) {
                  logHtml += `<div class="log-line info"> &raquo; Bet '${betName}' (${d.amount}): PUSH (Returned)</div>`;
                } else if (d.won) {
                  logHtml += `<div class="log-line win"> &raquo; Bet '${betName}' (${d.amount}): WON (+${d.payout} Chips)</div>`;
                } else {
                  logHtml += `<div class="log-line loss"> &raquo; Bet '${betName}' (${d.amount}): LOST</div>`;
                }
              });
              
              logEl.innerHTML += logHtml;
              logEl.scrollTop = logEl.scrollHeight;
            }

            // Keep Bets toggle: re-add resolved bets
            const keepBetsCheckbox = document.getElementById('craps-keep-bets-checkbox');
            const shouldKeep = keepBetsCheckbox ? keepBetsCheckbox.checked : true;

            if (shouldKeep) {
              payload.payoutDetails.forEach(d => {
                // If it resolved, re-place it
                if (this.clientGame.chips >= d.amount) {
                  const existing = this.currentBets.get(d.type) || 0;
                  this.currentBets.set(d.type, existing + d.amount);
                  
                  // Deduct locally to reflect planned bet
                  this.clientGame.chips -= d.amount;
                } else {
                  this.clientGame.showNotification("Bets cleared: Insufficient Chips to repeat some bets!", "error");
                }
              });
            } else {
              this.currentBets.clear();
            }

            // Re-render UI table bets
            const cells = this.modalBody.querySelectorAll('.craps-cell');
            cells.forEach(cell => {
              const chip = cell.querySelector('.bet-chip');
              if (chip) chip.remove();
            });
            
            this.reconstructActiveCrapsBetsUI();
            for (const [type, amount] of this.currentBets.entries()) {
              const cellType = type.startsWith('buy_') ? type.replace('buy_', 'place_') : type;
              const cell = this.modalBody.querySelector(`.craps-cell[data-bet="${cellType}"]`);
              if (cell) {
                this.updateCellBetUI(cell, amount, type.startsWith('buy_'));
              }
            }

            // Update total bet display
            const totalValEl = document.getElementById('craps-total-bet-val');
            if (totalValEl) {
              totalValEl.innerText = this.getBetTotal().toLocaleString();
            }

            // Update balance displays
            this.updateBalance();

            const rollBtn = document.getElementById('craps-roll-btn');
            if (rollBtn) rollBtn.disabled = false;
            const clearBtn = document.getElementById('craps-clear-btn');
            if (clearBtn) clearBtn.disabled = false;
          }, 500);
        }
      }, 100);
    }

    updateATSLights(rolled) {
      const rolledNumbers = rolled || [];
      const numEls = this.modalBody.querySelectorAll('.ats-num');
      numEls.forEach(el => {
        const val = parseInt(el.dataset.num);
        if (rolledNumbers.includes(val)) {
          el.classList.add('hit');
        } else {
          el.classList.remove('hit');
        }
      });
    }

    updateCrapsPucks(point) {
      this.modalBody.querySelectorAll('.craps-puck').forEach(p => p.remove());

      const displayEl = document.getElementById('craps-point-display');
      if (displayEl) {
        displayEl.innerText = point ? `ON: ${point}` : 'OFF';
        const puck = document.createElement('div');
        puck.className = `craps-puck puck-${point ? 'on' : 'off'}`;
        puck.innerText = point ? 'ON' : 'OFF';
        puck.style.position = 'static';
        puck.style.display = 'inline-flex';
        puck.style.marginLeft = '8px';
        displayEl.appendChild(puck);
      }

      if (point) {
        const cell = this.modalBody.querySelector(`.craps-cell[data-bet="place_${point}"]`);
        if (cell) {
          const puck = document.createElement('div');
          puck.className = 'craps-puck puck-on';
          puck.innerText = 'ON';
          cell.appendChild(puck);
        }
      }
    }

    renderDieDots(dieEl) {
      const val = parseInt(dieEl.dataset.val);
      dieEl.innerHTML = '';
      
      const dotsCount = val;
      for (let i = 0; i < dotsCount; i++) {
        const dot = document.createElement('div');
        dot.className = 'die-dot';
        dieEl.appendChild(dot);
      }
    }

    /* ==========================================================================
       SLOTS MINIGAME LAYOUT & INTERACTIVE LOGIC
       ========================================================================== */
    renderSlots() {
      this.modalBody.innerHTML = `
        <div class="slots-container" style="display:flex; flex-direction:column; align-items:center; gap:20px; padding:20px; text-align:center;">
          <div class="slots-reels" style="display:flex; gap:16px; background:#111111; border:4px solid var(--accent-blue); padding:20px 30px; border-radius:12px; box-shadow:0 0 20px rgba(0,240,255,0.2);">
            <div id="reel1" class="slot-reel" style="width:70px; height:90px; background:#222; border-radius:8px; border:2px solid rgba(255,255,255,0.1); display:flex; justify-content:center; align-items:center; font-size:42px;">🔔</div>
            <div id="reel2" class="slot-reel" style="width:70px; height:90px; background:#222; border-radius:8px; border:2px solid rgba(255,255,255,0.1); display:flex; justify-content:center; align-items:center; font-size:42px;">🍒</div>
            <div id="reel3" class="slot-reel" style="width:70px; height:90px; background:#222; border-radius:8px; border:2px solid rgba(255,255,255,0.1); display:flex; justify-content:center; align-items:center; font-size:42px;">7️⃣</div>
          </div>

          <div id="slots-stats-bar" style="display:flex; justify-content:space-between; align-items:center; width:100%; max-width:320px; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
            <div>Bet: <span id="slots-total-bet-val" style="color:var(--accent-gold); font-weight:800;">5</span> Chips</div>
            <div>Session Profit: <span id="minigame-session-profit" style="font-weight:800; color:#ffffff;">0</span> Chips</div>
          </div>

          <div class="controls-wrapper" style="display:flex; justify-content:space-between; align-items:center; gap:16px; width:100%; max-width:320px; margin-top: 10px;">
            <div class="chip-selector" style="display:flex; gap:8px;">
              <div class="picker-chip active" data-value="5">5</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
              <div class="picker-chip" data-value="500">500</div>
            </div>
            <button id="slots-spin-btn" class="action-btn primary" style="padding:12px 24px;">PULL LEVER</button>
          </div>

          <div id="slots-result-log" class="minigame-log-feed" style="width:100%; max-width:320px;">
            <div class="log-line info">Select bet size and click PULL LEVER to spin. Payout log appears here.</div>
          </div>
        </div>
      `;
      this.bindSlotsEvents();
    }

    bindSlotsEvents() {
      const self = this;
      const chips = this.modalBody.querySelectorAll('.picker-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          self.selectedChipValue = parseInt(this.dataset.value);
          self.logDebug(`Selected bet size: ${self.selectedChipValue} Chips`, 'info');
          const totalValEl = document.getElementById('slots-total-bet-val');
          if (totalValEl) totalValEl.innerText = self.selectedChipValue;
        });
      });

      this.modalBody.querySelector('#slots-spin-btn').addEventListener('click', () => {
        self.logDebug(`Pull Lever clicked! Preparing spin bet...`, 'info');
        if (this.isSpinning) {
          self.logDebug(`Pull rejected: isSpinning is already true.`, 'warning');
          return;
        }
        
        self.logDebug(`Verifying funds: selected=${this.selectedChipValue}, balance=${this.clientGame.chips}`, 'info');
        if (this.selectedChipValue > this.clientGame.chips) {
          self.logDebug(`Pull rejected: Insufficient chips!`, 'error');
          this.clientGame.showNotification("Insufficient Chips!", "error");
          return;
        }

        this.isSpinning = true;
        window.Casino.SoundManager.playSlotsSpin();
        const spinBtn = document.getElementById('slots-spin-btn');
        if (spinBtn) spinBtn.disabled = true;

        self.logDebug(`Sending PLAY_MINIGAME slots action to simulator...`, 'info');
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: 'slots',
          tableId: this.activeTableId,
          betAmount: this.selectedChipValue
        });
      });
    }

    handleSlotsPayout(payload) {
      this.logDebug(`handleSlotsPayout callback received: reels=[${payload.reels.join(',')}], net=${payload.netPayout}`, 'success');
      const reels = payload.reels;
      const reel1El = document.getElementById('reel1');
      const reel2El = document.getElementById('reel2');
      const reel3El = document.getElementById('reel3');

      const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
      let cycles = 0;
      this.logDebug(`Starting reels spin animation cycles...`, 'info');
      const interval = setInterval(() => {
        if (reel1El) reel1El.innerText = symbols[Math.floor(Math.random() * symbols.length)];
        if (reel2El) reel2El.innerText = symbols[Math.floor(Math.random() * symbols.length)];
        if (reel3El) reel3El.innerText = symbols[Math.floor(Math.random() * symbols.length)];
        cycles++;

        if (cycles >= 15) {
          clearInterval(interval);
          this.logDebug(`Stopping reels at target results: [${reels.join(',')}]`, 'info');
          if (reel1El) reel1El.innerText = reels[0];
          if (reel2El) reel2El.innerText = reels[1];
          if (reel3El) reel3El.innerText = reels[2];

          this.isSpinning = false;
          const spinBtn = document.getElementById('slots-spin-btn');
          if (spinBtn) spinBtn.disabled = false;

          const net = payload.netPayout;
          const netSign = net >= 0 ? `+${net}` : `${net}`;
          const lineClass = net > 0 ? 'win' : (net < 0 ? 'loss' : 'info');

          if (net > 0) {
            const rpText = payload.rpAwarded > 0 ? ` (+${payload.rpAwarded} 🧪)` : '';
            window.Casino.SoundManager.playWin();
            this.clientGame.showNotification(`🎉 SLOTS WIN! Payout: +${payload.totalWin} Chips${rpText}!`, "success");
            this.logDebug(`Payout resolved: WON +${payload.totalWin} Chips${rpText} (Net: +${net})`, 'success');
          } else {
            window.Casino.SoundManager.playLose();
            this.clientGame.showNotification(`😢 Lost: -${payload.betAmount} Chips`, "error");
            this.logDebug(`Payout resolved: LOST -${payload.betAmount} Chips`, 'error');
          }

          // Update session profit
          this.sessionProfit += net;
          const profitEl = document.getElementById('minigame-session-profit');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }

          const logEl = document.getElementById('slots-result-log');
          if (logEl) {
            const reelsStr = reels.join(' ');
            let logHtml = `<div class="log-line ${lineClass}"><strong>Reels: ${reelsStr} (Net: ${netSign})</strong></div>`;
            if (net > 0) {
              const rpText = payload.rpAwarded > 0 ? ` (+${payload.rpAwarded} 🧪)` : '';
              logHtml += `<div class="log-line win"> &raquo; Match win! Bet ${payload.betAmount} paid ${payload.totalWin}${rpText}</div>`;
            } else {
              logHtml += `<div class="log-line loss"> &raquo; No major match. Lost ${payload.betAmount}</div>`;
            }
            logEl.innerHTML += logHtml;
            logEl.scrollTop = logEl.scrollHeight;
          }

          if (payload.researchPoints !== undefined) this.clientGame.state.researchPoints = payload.researchPoints;
          if (payload.starRating !== undefined) this.clientGame.state.starRating = payload.starRating;
          if (payload.chips !== undefined) this.clientGame.chips = payload.chips;
          this.updateBalance();
        }
      }, 80);
    }

    /* ==========================================================================
       PLANET ARCADE CABINET LAYOUT & INTERACTIVE LOGIC
       ========================================================================== */
    renderMinigameMachine() {
      const self = this;
      this.modalBody.innerHTML = `
        <div class="arcade-container" style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:20px; text-align:center;">
          <div class="arcade-cabinet" style="width:280px; height:180px; background:#1a1a2e; border:4px solid var(--accent-gold); border-radius:12px; box-shadow:0 0 25px rgba(255, 215, 0, 0.2); display:flex; flex-direction:column; justify-content:center; align-items:center; position:relative; overflow:hidden;">
            <!-- Neon Header -->
            <div style="background:#ff007f; color:#fff; font-weight:bold; font-size:12px; padding:4px 0; width:100%; border-bottom:2px solid var(--accent-gold); letter-spacing:2px; text-shadow:0 0 6px #fff;">PLANET MICRO-ARCADE</div>
            
            <!-- Video Screen area -->
            <div style="flex-grow:1; width:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#000; position:relative;">
              <div id="arcade-screen-text" style="color:#39ff14; font-family:'Press Start 2P', monospace; font-size:9px; line-height:1.8; text-shadow:0 0 4px #39ff14; padding:20px;">
                READY TO PLAY?<br>SELECT BET AND<br>PRESS INSERT COIN!
              </div>
            </div>
            
            <!-- Cabinet controls bar -->
            <div style="background:#111; height:24px; width:100%; border-top:2px solid var(--accent-gold); display:flex; justify-content:space-around; align-items:center; padding:4px 0;">
              <div style="width:12px; height:12px; background:#ff0000; border-radius:50%;"></div>
              <div style="width:24px; height:6px; background:#fff; border-radius:3px;"></div>
              <div style="width:12px; height:12px; background:#0000ff; border-radius:50%;"></div>
            </div>
          </div>
          
          <div id="arcade-stats-bar" style="display:flex; justify-content:space-between; align-items:center; width:100%; max-width:280px; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-size:12px;">
            <div>Bet: <span id="arcade-total-bet-val" style="color:var(--accent-gold); font-weight:800;">10</span> Chips</div>
            <div>Session Profit: <span id="minigame-session-profit" style="font-weight:800; color:#ffffff;">0</span> Chips</div>
          </div>
          
          <div class="controls-wrapper" style="display:flex; justify-content:space-between; align-items:center; gap:16px; width:100%; max-width:280px;">
            <div class="chip-selector" style="display:flex; gap:6px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="50">50</div>
              <div class="picker-chip" data-value="100">100</div>
              <div class="picker-chip" data-value="250">250</div>
              <div class="picker-chip" data-value="500">500</div>
            </div>
            <button id="arcade-play-btn" class="action-btn primary" style="padding:10px 20px; font-size:12px; font-weight:bold;">INSERT COIN</button>
          </div>
          
          <div id="arcade-result-log" class="minigame-log-feed" style="width:100%; max-width:280px; font-size:11px;">
            <div class="log-line info">Win Planet Micro-games to win 2X payout!</div>
          </div>
        </div>
      `;
      
      this.updateSessionProfit(0);
      
      const playBtn = document.getElementById('arcade-play-btn');
      const logFeed = document.getElementById('arcade-result-log');
      const betValSpan = document.getElementById('arcade-total-bet-val');
      
      let betAmount = 10;
      
      const chipsPicker = this.modalBody.querySelectorAll('.picker-chip');
      chipsPicker.forEach(chip => {
        chip.addEventListener('click', () => {
          chipsPicker.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          betAmount = parseInt(chip.getAttribute('data-value'));
          if (betValSpan) betValSpan.innerText = betAmount;
          window.Casino.SoundManager.playBeep();
        });
      });
      
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          const client = window.Casino.clientInstance;
          if (!client) return;
          
          if (client.chips < betAmount) {
            this.logDebug("Insufficient chips to play!", "error");
            window.Casino.SoundManager.playLose();
            return;
          }
          
          this.overlayEl.classList.add('hidden');
          
          client.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            gameType: 'minigame_machine',
            tableId: this.activeTableId,
            action: 'bet',
            betAmount: betAmount
          });
          
          client.startQTEMinigame(
            "🕹️ ARCADE CHALLENGE",
            "Succeed the microgame to win 2X payout!",
            () => {
              client.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
                gameType: 'minigame_machine',
                tableId: this.activeTableId,
                action: 'outcome',
                outcome: 'win',
                betAmount: betAmount
              });
              
              this.overlayEl.classList.remove('hidden');
            },
            () => {
              client.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
                gameType: 'minigame_machine',
                tableId: this.activeTableId,
                action: 'outcome',
                outcome: 'lose',
                betAmount: betAmount
              });
              
              this.overlayEl.classList.remove('hidden');
            },
            'microgame'
          );
        });
      }
    }

    handleMinigameMachinePayout(payload) {
      this.updateBalance();
      if (payload.action === 'win') {
        this.logDebug(`CONGRATULATIONS! You won the microgame! Payout: +${payload.betAmount * 2} Chips`, 'success');
        this.sessionProfit += payload.betAmount;
        this.updateSessionProfit(this.sessionProfit);
      } else if (payload.action === 'lose') {
        this.logDebug(`GAME OVER! You failed the microgame. Lost ${payload.betAmount} Chips`, 'error');
        this.sessionProfit -= payload.betAmount;
        this.updateSessionProfit(this.sessionProfit);
      } else if (payload.action === 'bet_ack') {
        this.logDebug(`Coin inserted: Bet ${payload.betAmount} Chips. Starting microgame...`, 'info');
      }
    }

    /* ==========================================================================
       BLACKJACK MINIGAME RENDERING & EVENTS
       ========================================================================== */
    renderBlackjack(isElectronic = false) {
      this.blackjackBet = isElectronic ? 5 : 25;
      this.blackjackState = 'betting';
      this.isElectronicBlackjack = isElectronic;

      const chipSelectorHTML = isElectronic
        ? `<div class="picker-chip active" data-value="5">5</div>
           <div class="picker-chip" data-value="10">10</div>
           <div class="picker-chip" data-value="25">25</div>`
        : `<div class="picker-chip active" data-value="5">5</div>
           <div class="picker-chip" data-value="25">25</div>
           <div class="picker-chip" data-value="100">100</div>
           <div class="picker-chip" data-value="500">500</div>`;

      this.modalBody.innerHTML = `
        <div class="card-game-layout" style="display:flex; gap:16px; width:100%; max-width:850px; margin:0 auto; font-family: 'Outfit', sans-serif;">
          <div class="card-game-container" style="display:flex; flex-direction:column; gap:16px; align-items:center; flex: 2; padding:16px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
            <div style="text-align:center; width:100%;">
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">DEALER HAND (<span id="bj-dealer-score">0</span>)</div>
              <div id="bj-dealer-cards" style="display:flex; gap:10px; justify-content:center; min-height:80px; align-items:center;">
                <div style="color:rgba(255,255,255,0.2); font-size:12px;">Cards will be dealt here</div>
              </div>
            </div>
            <div style="width:80%; height:1px; background:rgba(255,255,255,0.05); margin:8px 0;"></div>
            <div style="text-align:center; width:100%;">
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">YOUR HAND (<span id="bj-player-score">0</span>)</div>
              <div id="bj-player-cards" style="display:flex; gap:10px; justify-content:center; min-height:80px; align-items:center;">
                <div style="color:rgba(255,255,255,0.2); font-size:12px;">Cards will be dealt here</div>
              </div>
            </div>
            <div id="bj-status-text" style="font-size:14px; font-weight:800; text-align:center; height:24px; color:#fff;">
              Place your bet to deal cards!
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-size:11px;">
              <div>Bet: <span id="bj-bet-val" style="color:var(--accent-gold); font-weight:800;">${this.blackjackBet}</span> / ${isElectronic ? '100' : '500'} Chips</div>
              <div>Session Profit: <span id="bj-profit-val" style="font-weight:800; color:#fff;">0</span> Chips</div>
            </div>
            <div class="controls-wrapper" style="width:100%;">
              <div class="chip-selector" id="bj-chip-selector" style="justify-content:center; gap:8px; margin-bottom:12px;">
                ${chipSelectorHTML}
              </div>
              <div class="action-buttons" style="justify-content:center; gap:8px; flex-wrap:wrap;">
                <button id="bj-deal-btn" class="action-btn primary" style="min-width:90px;">DEAL</button>
                <button id="bj-hit-btn" class="action-btn secondary" style="min-width:70px;" disabled>HIT</button>
                <button id="bj-stand-btn" class="action-btn secondary" style="min-width:70px;" disabled>STAND</button>
                <button id="bj-double-btn" class="action-btn secondary" style="min-width:70px;" disabled>DOUBLE</button>
                <button id="bj-split-btn" class="action-btn secondary" style="min-width:70px;" disabled>SPLIT</button>
              </div>
            </div>
          </div>
          <div id="bj-other-players-panel" style="display:flex; flex-direction:column; gap:10px; flex: 1.1; padding:16px; background:rgba(0,0,0,0.5); border-radius:12px; border:1px solid rgba(255,255,255,0.08); font-size:11px; max-height:420px; overflow-y:auto; box-sizing:border-box;">
            <div style="font-weight:bold; color:var(--accent-gold); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; text-align:center;">👥 PLAYERS AT TABLE</div>
            <div id="bj-other-players-list" style="display:flex; flex-direction:column; gap:12px; margin-top:6px; color:#aaa; text-align:center;">
              No other players at this table
            </div>
          </div>
        </div>
      `;

      this.bindBlackjackEvents();
    }

    bindBlackjackEvents() {
      const self = this;
      const selector = this.modalBody.querySelector('#bj-chip-selector');
      const chips = selector.querySelectorAll('.picker-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          if (self.blackjackState !== 'betting') return;
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          self.blackjackBet = parseInt(this.dataset.value);
          document.getElementById('bj-bet-val').innerText = self.blackjackBet;
        });
      });

      this.modalBody.querySelector('#bj-deal-btn').addEventListener('click', () => {
        if (self.clientGame.chips < self.blackjackBet) {
          self.clientGame.showNotification("Insufficient Chips!", "error");
          return;
        }
        self.blackjackState = 'playing';
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: self.isElectronicBlackjack ? 'elec_blackjack' : 'blackjack',
          tableId: self.activeTableId,
          action: 'deal',
          betAmount: self.blackjackBet
        });
      });

      this.modalBody.querySelector('#bj-hit-btn').addEventListener('click', () => {
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: self.isElectronicBlackjack ? 'elec_blackjack' : 'blackjack',
          tableId: self.activeTableId,
          action: 'hit'
        });
      });

      this.modalBody.querySelector('#bj-stand-btn').addEventListener('click', () => {
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: self.isElectronicBlackjack ? 'elec_blackjack' : 'blackjack',
          tableId: self.activeTableId,
          action: 'stand'
        });
      });

      this.modalBody.querySelector('#bj-double-btn').addEventListener('click', () => {
        if (self.clientGame.chips < self.blackjackBet) {
          self.clientGame.showNotification("Cannot afford to Double Down!", "error");
          return;
        }
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: self.isElectronicBlackjack ? 'elec_blackjack' : 'blackjack',
          tableId: self.activeTableId,
          action: 'double'
        });
      });

      this.modalBody.querySelector('#bj-split-btn').addEventListener('click', () => {
        if (self.clientGame.chips < self.blackjackBet) {
          self.clientGame.showNotification("Cannot afford to Split!", "error");
          return;
        }
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: self.isElectronicBlackjack ? 'elec_blackjack' : 'blackjack',
          tableId: self.activeTableId,
          action: 'split'
        });
      });
    }

    getCardBlackjackValue(card) {
      if (!card) return 0;
      if (['J', 'Q', 'K'].includes(card.val)) return 10;
      if (card.val === 'A') return 11;
      return parseInt(card.val) || 0;
    }

    handleBlackjackPayout(payload) {
      const pCards = payload.playerHand || [];
      const dCards = payload.dealerHand || [];
      const dScore = dCards.some(c => c.name === '?') ? '?' : this.getHandScore(dCards);

      const pContainer = document.getElementById('bj-player-cards');
      const dContainer = document.getElementById('bj-dealer-cards');

      if (dContainer) dContainer.innerHTML = dCards.map(c => this.renderCardHTML(c)).join('');

      if (payload.isSplit) {
        if (pContainer) {
          pContainer.innerHTML = `
            <div style="border: 2px solid ${payload.activeHandIndex === 0 ? '#39ff14' : 'rgba(255,255,255,0.08)'}; background:${payload.activeHandIndex === 0 ? 'rgba(57,255,20,0.03)' : 'transparent'}; padding: 8px; border-radius: 8px; margin-bottom: 8px; width: 100%; box-sizing: border-box; text-align: center;">
              <div style="font-size:10px; color:${payload.activeHandIndex === 0 ? '#39ff14' : '#aaa'}; font-weight:bold;">HAND 1 (Score: ${this.getHandScore(payload.playerHand1)})</div>
              <div style="display:flex; gap:6px; justify-content:center; margin-top:6px;">
                ${payload.playerHand1.map(c => this.renderCardHTML(c)).join('')}
              </div>
            </div>
            <div style="border: 2px solid ${payload.activeHandIndex === 1 ? '#39ff14' : 'rgba(255,255,255,0.08)'}; background:${payload.activeHandIndex === 1 ? 'rgba(57,255,20,0.03)' : 'transparent'}; padding: 8px; border-radius: 8px; width: 100%; box-sizing: border-box; text-align: center;">
              <div style="font-size:10px; color:${payload.activeHandIndex === 1 ? '#39ff14' : '#aaa'}; font-weight:bold;">HAND 2 (Score: ${this.getHandScore(payload.playerHand2)})</div>
              <div style="display:flex; gap:6px; justify-content:center; margin-top:6px;">
                ${payload.playerHand2.map(c => this.renderCardHTML(c)).join('')}
              </div>
            </div>
          `;
        }
        document.getElementById('bj-player-score').innerText = `${this.getHandScore(payload.playerHand1)} | ${this.getHandScore(payload.playerHand2)}`;
      } else {
        if (pContainer) pContainer.innerHTML = pCards.map(c => this.renderCardHTML(c)).join('');
        const pScore = this.getHandScore(pCards);
        document.getElementById('bj-player-score').innerText = pScore;
      }
      
      document.getElementById('bj-dealer-score').innerText = dScore;

      const dealBtn = document.getElementById('bj-deal-btn');
      const hitBtn = document.getElementById('bj-hit-btn');
      const standBtn = document.getElementById('bj-stand-btn');
      const doubleBtn = document.getElementById('bj-double-btn');
      const splitBtn = document.getElementById('bj-split-btn');

      if (payload.state === 'playing') {
        this.blackjackState = 'playing';
        if (dealBtn) dealBtn.disabled = true;
        if (hitBtn) hitBtn.disabled = false;
        if (standBtn) standBtn.disabled = false;
        if (doubleBtn) doubleBtn.disabled = (this.clientGame.chips < this.blackjackBet);
        
        // Split eligibility: same value/rank, only 2 cards in hand, not yet split
        const canSplit = !payload.isSplit && pCards.length === 2 && 
                          (pCards[0].val === pCards[1].val || this.getCardBlackjackValue(pCards[0]) === this.getCardBlackjackValue(pCards[1])) && 
                          (this.clientGame.chips >= this.blackjackBet);
        if (splitBtn) splitBtn.disabled = !canSplit;

        document.getElementById('bj-status-text').innerText = payload.isSplit 
          ? `Playing Hand ${payload.activeHandIndex + 1} - Hit or Stand?`
          : "Hit, Stand, or Double Down?";
        document.getElementById('bj-status-text').style.color = '#fff';
      } else {
        this.blackjackState = 'betting';
        if (dealBtn) dealBtn.disabled = false;
        if (hitBtn) hitBtn.disabled = true;
        if (standBtn) standBtn.disabled = true;
        if (doubleBtn) doubleBtn.disabled = true;
        if (splitBtn) splitBtn.disabled = true;

        const outcome = payload.outcome;
        const statusTextEl = document.getElementById('bj-status-text');

        if (outcome === 'blackjack') {
          statusTextEl.innerText = `Natural Blackjack! You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusTextEl.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (outcome === 'win' || outcome === 'dealer_bust') {
          statusTextEl.innerText = `You Won! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusTextEl.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (outcome === 'push') {
          statusTextEl.innerText = "Push. Bets returned.";
          statusTextEl.style.color = '#00f0ff';
        } else {
          statusTextEl.innerText = `Dealer Wins! Lost bet.`;
          statusTextEl.style.color = '#ff4d4d';
          window.Casino.SoundManager.playLose();
        }

        this.sessionProfit += payload.netPayout;
        const profitEl = document.getElementById('bj-profit-val');
        if (profitEl) {
          profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
          profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
        }
      }

      // Render other players at the table in the sidebar
      if (payload.otherPlayers) {
        payload.otherPlayers.forEach(p => {
          this.otherPlayersHands.set(p.playerId, p);
        });
      }
      this.updateOtherPlayers(this.clientGame.state);

      this.updateBalance();
    }

    renderCardHTML(card) {
      if (!card || card.name === '?') {
        return `<div class="card face-down" style="width: 55px; height: 80px; border-radius: 6px; border: 2px solid #ff4d4d; background: repeating-linear-gradient(45deg, #111, #111 5px, #ff4d4d 5px, #ff4d4d 10px); box-shadow: 0 4px 8px rgba(0,0,0,0.5);"></div>`;
      }
      const color = ['♥', '♦'].includes(card.suit) ? '#ff4d4d' : '#fff';
      return `
        <div class="card" style="position: relative; width: 55px; height: 80px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: linear-gradient(135deg, #1c1c1e, #2c2c2e); color: ${color}; box-shadow: 0 4px 8px rgba(0,0,0,0.5); font-family: sans-serif; font-weight: bold; font-size: 14px; display: flex; flex-direction: column; justify-content: space-between; padding: 6px;">
          <div style="text-align: left; line-height: 1;">${card.val}<br><span style="font-size: 10px;">${card.suit}</span></div>
          <div style="font-size: 20px; text-align: center;">${card.suit}</div>
          <div style="text-align: right; transform: rotate(180deg); line-height: 1;">${card.val}<br><span style="font-size: 10px;">${card.suit}</span></div>
        </div>
      `;
    }

    getHandScore(hand) {
      let score = hand.reduce((sum, c) => sum + c.score, 0);
      let aces = hand.filter(c => c.val === 'A').length;
      while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
      }
      return score;
    }

    /* ==========================================================================
       RIDE THE BUS MINIGAME RENDERING & EVENTS
       ========================================================================== */
    renderRideTheBus() {
      this.rtbBet = 10;
      this.rtbStep = 1;
      this.rtbState = 'betting';

      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; gap:16px; width:100%; max-width:700px; margin:0 auto; font-family:'Outfit', sans-serif;">
          <div style="flex:2; display:flex; flex-direction:column; gap:16px; align-items:center; padding:16px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08); box-sizing:border-box;">
            <div style="font-size: 16px; font-weight: 800; color: var(--accent-blue);" id="rtb-step-title">
              Step 1: Red or Black?
            </div>
            <div style="text-align:center; width:100%;">
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">BUS CARDS</div>
              <div id="rtb-cards" style="display:flex; gap:10px; justify-content:center; min-height:80px; align-items:center;">
                <div style="color:rgba(255,255,255,0.2); font-size:12px;">Bus will start on Deal</div>
              </div>
            </div>
            <div id="rtb-status-text" style="font-size:14px; font-weight:800; text-align:center; height:24px; color:#fff;">
              Place your bet to start the bus!
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-size:11px;">
              <div>Bet: <span id="rtb-bet-val" style="color:var(--accent-gold); font-weight:800;">10</span> Chips</div>
              <div>Session Profit: <span id="rtb-profit-val" style="font-weight:800; color:#fff;">0</span> Chips</div>
            </div>
            <div class="controls-wrapper" style="width:100%;">
              <div class="chip-selector" id="rtb-chip-selector" style="justify-content:center; gap:8px; margin-bottom:12px;">
                <div class="picker-chip active" data-value="10">10</div>
                <div class="picker-chip" data-value="25">25</div>
                <div class="picker-chip" data-value="100">100</div>
              </div>
              
              <div id="rtb-guess-buttons" style="display:none; justify-content:center; gap:12px; margin-bottom:12px;">
                <!-- Dynamic guess buttons -->
              </div>
              
              <div class="action-buttons" style="justify-content:center; gap:12px;">
                <button id="rtb-deal-btn" class="action-btn primary" style="min-width:100px;">START BUS</button>
                <button id="rtb-cashout-btn" class="action-btn secondary" style="min-width:100px; display:none;">CASHOUT</button>
              </div>
            </div>
          </div>
          <div id="rtb-other-players-panel" style="display:flex; flex-direction:column; gap:10px; flex: 1.1; padding:16px; background:rgba(0,0,0,0.5); border-radius:12px; border:1px solid rgba(255,255,255,0.08); font-size:11px; max-height:420px; overflow-y:auto; box-sizing:border-box;">
            <div style="font-weight:bold; color:var(--accent-gold); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; text-align:center;">👥 PLAYERS AT TABLE</div>
            <div id="rtb-other-players-list" style="display:flex; flex-direction:column; gap:12px; margin-top:6px; color:#aaa; text-align:center;">
              No other players at this table
            </div>
          </div>
        </div>
      `;

      this.bindRideTheBusEvents();
    }

    bindRideTheBusEvents() {
      const self = this;
      const selector = this.modalBody.querySelector('#rtb-chip-selector');
      const chips = selector.querySelectorAll('.picker-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          if (self.rtbState !== 'betting') return;
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          self.rtbBet = parseInt(this.dataset.value);
          document.getElementById('rtb-bet-val').innerText = self.rtbBet;
        });
      });

      this.modalBody.querySelector('#rtb-deal-btn').addEventListener('click', () => {
        if (self.clientGame.chips < self.rtbBet) {
          self.clientGame.showNotification("Insufficient Chips!", "error");
          return;
        }
        self.rtbState = 'playing';
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: 'ride_the_bus',
          tableId: self.activeTableId,
          action: 'deal',
          betAmount: self.rtbBet
        });
      });

      this.modalBody.querySelector('#rtb-cashout-btn').addEventListener('click', () => {
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: 'ride_the_bus',
          tableId: self.activeTableId,
          action: 'cashout'
        });
      });
    }

    handleRideTheBusPayout(payload) {
      const step = payload.step;
      const history = payload.history || [];
      const container = document.getElementById('rtb-cards');
      if (container && history.length > 0) {
        container.innerHTML = history.map(c => this.renderCardHTML(c)).join('');
      }

      const stepTitleEl = document.getElementById('rtb-step-title');
      const statusTextEl = document.getElementById('rtb-status-text');
      const guessContainer = document.getElementById('rtb-guess-buttons');
      const dealBtn = document.getElementById('rtb-deal-btn');
      const cashoutBtn = document.getElementById('rtb-cashout-btn');
      const self = this;

      if (payload.state === 'playing') {
        this.rtbState = 'playing';
        this.rtbStep = step;
        dealBtn.style.display = 'none';
        cashoutBtn.style.display = step > 1 ? 'block' : 'none';
        guessContainer.style.display = 'flex';

        if (step === 1) {
          stepTitleEl.innerText = "Step 1: Red or Black?";
          statusTextEl.innerText = "Is the next card Red or Black?";
          guessContainer.innerHTML = `
            <button class="action-btn" data-guess="red" style="background:#ff4d4d; border-color:#ff4d4d; color:#fff; min-width:80px;">RED</button>
            <button class="action-btn" data-guess="black" style="background:#111; border-color:#fff; color:#fff; min-width:80px;">BLACK</button>
          `;
        } else if (step === 2) {
          stepTitleEl.innerText = "Step 2: Higher or Lower?";
          statusTextEl.innerText = `Is next card higher or lower than ${payload.currentCard.val}?`;
          guessContainer.innerHTML = `
            <button class="action-btn primary" data-guess="higher" style="min-width:80px;">HIGHER</button>
            <button class="action-btn secondary" data-guess="lower" style="min-width:80px;">LOWER</button>
          `;
        } else if (step === 3) {
          stepTitleEl.innerText = "Step 3: In Between or Outside?";
          const h = history;
          statusTextEl.innerText = `Is next card in-between or outside ${h[h.length-2].val} and ${h[h.length-1].val}?`;
          guessContainer.innerHTML = `
            <button class="action-btn primary" data-guess="between" style="min-width:100px;">IN BETWEEN</button>
            <button class="action-btn secondary" data-guess="outside" style="min-width:100px;">OUTSIDE</button>
          `;
        } else if (step === 4) {
          stepTitleEl.innerText = "Step 4: Guess the Suit!";
          statusTextEl.innerText = "Guess the exact suit of the final card:";
          guessContainer.innerHTML = `
            <button class="action-btn" data-guess="♠" style="color:#fff; border-color:#fff; min-width:50px;">♠</button>
            <button class="action-btn" data-guess="♥" style="color:#ff4d4d; border-color:#ff4d4d; min-width:50px;">♥</button>
            <button class="action-btn" data-guess="♦" style="color:#ff4d4d; border-color:#ff4d4d; min-width:50px;">♦</button>
            <button class="action-btn" data-guess="♣" style="color:#fff; border-color:#fff; min-width:50px;">♣</button>
          `;
        }

        guessContainer.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', function() {
            const guess = this.dataset.guess;
            self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
              gameType: 'ride_the_bus',
              tableId: self.activeTableId,
              guess: guess
            });
          });
        });
      } else {
        this.rtbState = 'betting';
        dealBtn.style.display = 'block';
        cashoutBtn.style.display = 'none';
        guessContainer.style.display = 'none';
        if (stepTitleEl) stepTitleEl.innerText = "Ride The Bus Complete";

        const outcome = payload.outcome;
        if (outcome === 'cashout') {
          statusTextEl.innerText = `Cashout! You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusTextEl.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (outcome === 'win_bus') {
          statusTextEl.innerText = `🎉 WON THE BUS! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusTextEl.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else {
          statusTextEl.innerText = "Bust! Take a Drink (Lost bet).";
          statusTextEl.style.color = '#ff4d4d';
          window.Casino.SoundManager.playLose();
        }

        this.sessionProfit += payload.netPayout;
        const profitEl = document.getElementById('rtb-profit-val');
        if (profitEl) {
          profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
          profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
        }
      }
      if (payload.otherPlayers) {
        payload.otherPlayers.forEach(p => {
          this.otherPlayersHands.set(p.playerId, p);
        });
      }
      this.updateOtherPlayers(this.clientGame.state);

      this.updateBalance();
    }

    /* ==========================================================================
       THREE CARD POKER RENDERING & EVENTS
       ========================================================================== */
    renderThreeCardPoker() {
      this.tcpBet = 10;
      this.tcpState = 'betting';

      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:16px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:16px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">DEALER HAND</div>
            <div id="tcp-dealer-cards" style="display:flex; gap:10px; justify-content:center; min-height:80px; align-items:center;">
              <div style="color:rgba(255,255,255,0.2); font-size:12px;">Cards will be dealt here</div>
            </div>
          </div>
          <div style="width:80%; height:1px; background:rgba(255,255,255,0.05); margin:8px 0;"></div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">YOUR HAND</div>
            <div id="tcp-player-cards" style="display:flex; gap:10px; justify-content:center; min-height:80px; align-items:center;">
              <div style="color:rgba(255,255,255,0.2); font-size:12px;">Cards will be dealt here</div>
            </div>
          </div>
          <div id="tcp-status-text" style="font-size:14px; font-weight:800; text-align:center; height:24px; color:#fff;">
            Place Ante bet to deal hands!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); font-size:11px;">
            <div>Ante: <span id="tcp-bet-val" style="color:var(--accent-gold); font-weight:800;">10</span> Chips</div>
            <div>Session Profit: <span id="tcp-profit-val" style="font-weight:800; color:#fff;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="tcp-chip-selector" style="justify-content:center; gap:8px; margin-bottom:12px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div class="action-buttons" style="justify-content:center; gap:12px;">
              <button id="tcp-deal-btn" class="action-btn primary" style="min-width:100px;">DEAL ANTE</button>
              <button id="tcp-fold-btn" class="action-btn secondary" style="min-width:80px;" disabled>FOLD</button>
              <button id="tcp-play-btn" class="action-btn primary" style="min-width:110px;" disabled>PLAY (1x Ante)</button>
            </div>
          </div>
        </div>
      `;

      this.bindThreeCardPokerEvents();
    }

    bindThreeCardPokerEvents() {
      const self = this;
      const selector = this.modalBody.querySelector('#tcp-chip-selector');
      const chips = selector.querySelectorAll('.picker-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function() {
          if (self.tcpState !== 'betting') return;
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          self.tcpBet = parseInt(this.dataset.value);
          document.getElementById('tcp-bet-val').innerText = self.tcpBet;
        });
      });

      this.modalBody.querySelector('#tcp-deal-btn').addEventListener('click', () => {
        if (self.clientGame.chips < self.tcpBet) {
          self.clientGame.showNotification("Insufficient Chips!", "error");
          return;
        }
        self.tcpState = 'playing';
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: 'three_card_poker',
          tableId: self.activeTableId,
          action: 'deal',
          betAmount: self.tcpBet
        });
      });

      this.modalBody.querySelector('#tcp-fold-btn').addEventListener('click', () => {
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: 'three_card_poker',
          tableId: self.activeTableId,
          action: 'fold'
        });
      });

      this.modalBody.querySelector('#tcp-play-btn').addEventListener('click', () => {
        if (self.clientGame.chips < self.tcpBet) {
          self.clientGame.showNotification("Insufficient Chips to bet Play!", "error");
          return;
        }
        self.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          gameType: 'three_card_poker',
          tableId: self.activeTableId,
          action: 'play'
        });
      });
    }

    handleThreeCardPokerPayout(payload) {
      const pCards = payload.playerHand;
      const dCards = payload.dealerHand;

      const pContainer = document.getElementById('tcp-player-cards');
      const dContainer = document.getElementById('tcp-dealer-cards');

      if (pContainer) pContainer.innerHTML = pCards.map(c => this.renderCardHTML(c)).join('');
      if (dContainer) dContainer.innerHTML = dCards.map(c => this.renderCardHTML(c)).join('');

      const dealBtn = document.getElementById('tcp-deal-btn');
      const foldBtn = document.getElementById('tcp-fold-btn');
      const playBtn = document.getElementById('tcp-play-btn');

      if (payload.state === 'playing') {
        this.tcpState = 'playing';
        dealBtn.disabled = true;
        foldBtn.disabled = false;
        playBtn.disabled = false;
        document.getElementById('tcp-status-text').innerText = "Fold or Play (1x Ante bet)?";
        document.getElementById('tcp-status-text').style.color = '#fff';
      } else {
        this.tcpState = 'betting';
        dealBtn.disabled = false;
        foldBtn.disabled = true;
        playBtn.disabled = true;

        const outcome = payload.outcome;
        const statusTextEl = document.getElementById('tcp-status-text');

        if (outcome === 'dealer_no_qualify') {
          statusTextEl.innerText = `Dealer does not qualify! You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusTextEl.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (outcome === 'win') {
          statusTextEl.innerText = `You Won! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusTextEl.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (outcome === 'push') {
          statusTextEl.innerText = "Push. Bets returned.";
          statusTextEl.style.color = '#00f0ff';
        } else if (outcome === 'fold') {
          statusTextEl.innerText = "Folded. Lost Ante bet.";
          statusTextEl.style.color = '#ff4d4d';
          window.Casino.SoundManager.playLose();
        } else {
          statusTextEl.innerText = "Dealer Wins! Lost bets.";
          statusTextEl.style.color = '#ff4d4d';
          window.Casino.SoundManager.playLose();
        }

        this.sessionProfit += payload.netPayout;
        const profitEl = document.getElementById('tcp-profit-val');
        if (profitEl) {
          profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
          profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       BACCARAT / ELEC BACCARAT CLIENT
       ========================================================================== */
    renderBaccarat(isElectronic = false) {
      this.baccaratBets = { player: 0, banker: 0, tie: 0 };
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; gap:16px; justify-content:center; width:100%;">
            <div style="text-align:center;">
              <div style="font-size:11px; color:#aaa;">PLAYER HAND</div>
              <div id="bac-player-cards" style="display:flex; gap:6px; min-height:80px; align-items:center; justify-content:center;">-</div>
              <div id="bac-player-score" style="font-weight:bold; color:#00f0ff;">Score: 0</div>
            </div>
            <div style="font-size:24px; color:rgba(255,255,255,0.2); align-self:center;">VS</div>
            <div style="text-align:center;">
              <div style="font-size:11px; color:#aaa;">BANKER HAND</div>
              <div id="bac-banker-cards" style="display:flex; gap:6px; min-height:80px; align-items:center; justify-content:center;">-</div>
              <div id="bac-banker-score" style="font-weight:bold; color:var(--accent-pink);">Score: 0</div>
            </div>
          </div>
          <div id="bac-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bets on PLAYER, BANKER, or TIE!
          </div>
          <div style="display:flex; gap:12px; width:100%; justify-content:center; margin:8px 0;">
            <button id="btn-bac-bet-player" class="minigame-btn action" style="flex:1; border:2px solid #00f0ff; background:rgba(0,240,255,0.05); color:#00f0ff; font-weight:bold; font-size:12px; padding:10px; cursor:pointer;">PLAYER Bet (<span id="bac-p-bet">0</span>)</button>
            <button id="btn-bac-bet-tie" class="minigame-btn" style="flex:1; border:2px solid var(--accent-gold); background:rgba(255,215,0,0.05); color:var(--accent-gold); font-weight:bold; font-size:12px; padding:10px; cursor:pointer;">TIE Bet (<span id="bac-t-bet">0</span>)</button>
            <button id="btn-bac-bet-banker" class="minigame-btn action" style="flex:1; border:2px solid var(--accent-pink); background:rgba(255,0,127,0.05); color:var(--accent-pink); font-weight:bold; font-size:12px; padding:10px; cursor:pointer;">BANKER Bet (<span id="bac-b-bet">0</span>)</button>
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Session Profit: <span id="bac-profit-val" style="font-weight:bold;">0</span> Chips</div>
            <div id="bac-chip-val" style="color:var(--accent-gold);">Chip: 5</div>
          </div>
          <div class="controls-wrapper" style="width:100%; display:flex; gap:12px; justify-content:center;">
            <button id="btn-bac-clear" class="minigame-btn reset" style="flex:1; padding:10px; cursor:pointer;">Clear Bets</button>
            <button id="btn-bac-deal" class="minigame-btn action" style="flex:2; padding:10px; cursor:pointer;">Deal Cards</button>
          </div>
        </div>
      `;

      const pBet = document.getElementById('bac-p-bet');
      const bBet = document.getElementById('bac-b-bet');
      const tBet = document.getElementById('bac-t-bet');
      const chipText = document.getElementById('bac-chip-val');

      const addBet = (side) => {
        const cost = isElectronic ? 5 : 10;
        this.baccaratBets[side] += cost;
        pBet.innerText = this.baccaratBets.player;
        bBet.innerText = this.baccaratBets.banker;
        tBet.innerText = this.baccaratBets.tie;
        window.Casino.SoundManager.playPlaceBet();
      };

      document.getElementById('btn-bac-bet-player').onclick = () => addBet('player');
      document.getElementById('btn-bac-bet-banker').onclick = () => addBet('banker');
      document.getElementById('btn-bac-bet-tie').onclick = () => addBet('tie');

      document.getElementById('btn-bac-clear').onclick = () => {
        this.baccaratBets = { player: 0, banker: 0, tie: 0 };
        pBet.innerText = '0';
        bBet.innerText = '0';
        tBet.innerText = '0';
        window.Casino.SoundManager.playRemoveBet();
      };

      document.getElementById('btn-bac-deal').onclick = () => {
        const bets = [];
        if (this.baccaratBets.player > 0) bets.push({ type: 'player', amount: this.baccaratBets.player });
        if (this.baccaratBets.banker > 0) bets.push({ type: 'banker', amount: this.baccaratBets.banker });
        if (this.baccaratBets.tie > 0) bets.push({ type: 'tie', amount: this.baccaratBets.tie });

        if (bets.length === 0) {
          this.logDebug("Please place at least one bet!", "error");
          return;
        }

        const totalCost = bets.reduce((sum, b) => sum + b.amount, 0);
        if (this.clientGame.chips < totalCost) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: isElectronic ? 'elec_baccarat' : 'baccarat',
          bets
        });
      };
    }

    handleBaccaratPayout(payload) {
      const pCards = document.getElementById('bac-player-cards');
      const bCards = document.getElementById('bac-banker-cards');
      const pScore = document.getElementById('bac-player-score');
      const bScore = document.getElementById('bac-banker-score');
      const statusText = document.getElementById('bac-status-text');

      if (pCards && bCards && pScore && bScore && statusText) {
        pCards.innerHTML = payload.playerHand.map(c => this.renderCardHTML(c)).join('');
        bCards.innerHTML = payload.bankerHand.map(c => this.renderCardHTML(c)).join('');
        pScore.innerText = `Score: ${payload.pSum}`;
        bScore.innerText = `Score: ${payload.bSum}`;

        const outcomeText = payload.winningSide === 'tie' ? "TIE!" : `${payload.winningSide.toUpperCase()} wins!`;
        if (payload.netPayout > 0) {
          statusText.innerText = `${outcomeText} You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusText.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (payload.netPayout < 0) {
          statusText.innerText = `${outcomeText} You Lost ${Math.abs(payload.netPayout)} Chips.`;
          statusText.style.color = '#ff4d4d';
          window.Casino.SoundManager.playLose();
        } else {
          statusText.innerText = `${outcomeText} Push.`;
          statusText.style.color = '#00f0ff';
        }

        this.sessionProfit += payload.netPayout;
        const profitEl = document.getElementById('bac-profit-val');
        if (profitEl) {
          profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
          profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       TEXAS HOLD'EM BONUS CLIENT
       ========================================================================== */
    renderTexasHoldem() {
      this.texasHoldemBet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">DEALER HAND</div>
            <div id="th-dealer-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">COMMUNITY CARDS</div>
            <div id="th-community-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">YOUR HAND</div>
            <div id="th-player-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div id="th-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place Ante bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Ante: <span id="th-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="th-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="th-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-th-action" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('th-bet-val');
      const actionBtn = document.getElementById('btn-th-action');
      const chipSelector = document.getElementById('th-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.texasHoldemBet = parseInt(chip.dataset.value);
          betVal.innerText = this.texasHoldemBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      actionBtn.onclick = () => {
        const curText = actionBtn.innerText;
        let action = 'deal';
        if (curText === 'FLOP') action = 'flop';
        else if (curText === 'TURN') action = 'turn';
        else if (curText === 'RIVER') action = 'river';

        if (action === 'deal' && this.clientGame.chips < this.texasHoldemBet) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'texas_holdem',
          action,
          betAmount: this.texasHoldemBet
        });
      };
    }

    handleTexasHoldemPayout(payload) {
      const pCards = document.getElementById('th-player-cards');
      const dCards = document.getElementById('th-dealer-cards');
      const cCards = document.getElementById('th-community-cards');
      const statusText = document.getElementById('th-status-text');
      const actionBtn = document.getElementById('btn-th-action');

      if (pCards && dCards && cCards && statusText && actionBtn) {
        pCards.innerHTML = payload.playerHand.map(c => this.renderCardHTML(c)).join('');
        dCards.innerHTML = payload.dealerHand.map(c => this.renderCardHTML(c)).join('');
        cCards.innerHTML = payload.community.map(c => this.renderCardHTML(c)).join('');

        if (payload.state === 'flop') {
          statusText.innerText = "Revealed hole cards! Click FLOP to view community cards.";
          statusText.style.color = '#fff';
          actionBtn.innerText = 'FLOP';
        } else if (payload.state === 'turn') {
          statusText.innerText = "Flop revealed! Click TURN to see 4th card.";
          actionBtn.innerText = 'TURN';
        } else if (payload.state === 'river') {
          statusText.innerText = "Turn revealed! Click RIVER to see 5th card.";
          actionBtn.innerText = 'RIVER';
        } else if (payload.state === 'resolved') {
          actionBtn.innerText = 'DEAL';
          if (payload.outcome === 'win') {
            statusText.innerText = `You Won! +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'push') {
            statusText.innerText = "Push. Ante returned.";
            statusText.style.color = '#00f0ff';
          } else {
            statusText.innerText = "Dealer wins. Ante lost.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('th-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       PAI GOW POKER CLIENT
       ========================================================================== */
    renderPaiGow() {
      this.paiGowBet = 10;
      this.selectedHighIndices = [];
      this.paiGowCards = [];

      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">DEALER HAND (HIGH / LOW)</div>
            <div id="pg-dealer-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">YOUR 7 CARDS (Click 5 cards for your HIGH hand, remaining 2 will be LOW)</div>
            <div id="pg-player-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center; cursor:pointer;">-</div>
          </div>
          <div id="pg-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place Ante bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="pg-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="pg-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="pg-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-pg-action" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('pg-bet-val');
      const actionBtn = document.getElementById('btn-pg-action');
      const chipSelector = document.getElementById('pg-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.paiGowBet = parseInt(chip.dataset.value);
          betVal.innerText = this.paiGowBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      actionBtn.onclick = () => {
        if (actionBtn.innerText === 'DEAL') {
          if (this.clientGame.chips < this.paiGowBet) {
            this.logDebug("Insufficient chips!", "error");
            return;
          }
          this.selectedHighIndices = [];
          this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            tableId: this.activeTableId,
            gameType: 'pai_gow',
            action: 'deal',
            betAmount: this.paiGowBet
          });
        } else {
          if (this.selectedHighIndices.length !== 5) {
            this.logDebug("You must select exactly 5 cards for the High hand!", "error");
            return;
          }
          this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            tableId: this.activeTableId,
            gameType: 'pai_gow',
            action: 'split',
            highHandIndices: this.selectedHighIndices
          });
        }
      };
    }

    handlePaiGowPayout(payload) {
      const pCards = document.getElementById('pg-player-cards');
      const dCards = document.getElementById('pg-dealer-cards');
      const statusText = document.getElementById('pg-status-text');
      const actionBtn = document.getElementById('btn-pg-action');

      if (pCards && dCards && statusText && actionBtn) {
        if (payload.state === 'playing') {
          this.paiGowCards = payload.playerCards;
          actionBtn.innerText = 'SPLIT HANDS';
          statusText.innerText = "Select exactly 5 cards to be split into your High hand.";
          statusText.style.color = '#fff';

          const renderSelectable = () => {
            pCards.innerHTML = this.paiGowCards.map((c, idx) => {
              const selected = this.selectedHighIndices.includes(idx);
              const cardHTML = this.renderCardHTML(c);
              return `<div data-index="${idx}" style="transform:${selected?'translateY(-10px)':'none'}; border:${selected?'2px solid #00f0ff':'none'}; border-radius:6px; transition:all 0.15s ease;">${cardHTML}</div>`;
            }).join('');

            Array.from(pCards.children).forEach(el => {
              el.onclick = () => {
                const idx = parseInt(el.dataset.index);
                if (this.selectedHighIndices.includes(idx)) {
                  this.selectedHighIndices = this.selectedHighIndices.filter(x => x !== idx);
                } else {
                  if (this.selectedHighIndices.length < 5) {
                    this.selectedHighIndices.push(idx);
                  }
                }
                renderSelectable();
              };
            });
          };

          renderSelectable();
          dCards.innerHTML = `<div style="color:rgba(255,255,255,0.2); font-size:12px;">Waiting for split...</div>`;
        } else if (payload.state === 'resolved') {
          actionBtn.innerText = 'DEAL';
          pCards.innerHTML = `
            <div style="text-align:center;">
              <div style="font-size:10px; color:#aaa;">HIGH</div>
              <div style="display:flex; gap:4px;">${payload.pHigh.map(c => this.renderCardHTML(c)).join('')}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px; color:#aaa;">LOW</div>
              <div style="display:flex; gap:4px;">${payload.pLow.map(c => this.renderCardHTML(c)).join('')}</div>
            </div>
          `;
          dCards.innerHTML = `
            <div style="text-align:center;">
              <div style="font-size:10px; color:#aaa;">HIGH</div>
              <div style="display:flex; gap:4px;">${payload.dHigh.map(c => this.renderCardHTML(c)).join('')}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px; color:#aaa;">LOW</div>
              <div style="display:flex; gap:4px;">${payload.dLow.map(c => this.renderCardHTML(c)).join('')}</div>
            </div>
          `;

          if (payload.outcome === 'win') {
            statusText.innerText = `You Won Both Hands! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'push') {
            statusText.innerText = "Split (1 win, 1 loss). Bet returned.";
            statusText.style.color = '#00f0ff';
          } else {
            statusText.innerText = "Lost Both Hands. Lost bet.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('pg-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       SIC BO / ELEC SIC BO CLIENT
       ========================================================================== */
    renderSicBo(isElectronic = false) {
      this.sicBoBets = {};
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; gap:12px; justify-content:center; width:100%;">
            <div id="sb-die1" style="width:40px; height:40px; border-radius:6px; background:#fff; color:#000; font-size:24px; font-weight:bold; display:flex; align-items:center; justify-content:center; border:2px solid #aaa;">-</div>
            <div id="sb-die2" style="width:40px; height:40px; border-radius:6px; background:#fff; color:#000; font-size:24px; font-weight:bold; display:flex; align-items:center; justify-content:center; border:2px solid #aaa;">-</div>
            <div id="sb-die3" style="width:40px; height:40px; border-radius:6px; background:#fff; color:#000; font-size:24px; font-weight:bold; display:flex; align-items:center; justify-content:center; border:2px solid #aaa;">-</div>
          </div>
          <div id="sb-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bets on Small, Big, or Triple Any!
          </div>
          <div style="display:flex; gap:12px; width:100%; justify-content:center; margin:8px 0;">
            <button id="btn-sb-bet-small" class="minigame-btn" style="flex:1; border-color:#00f0ff;">SMALL (4-10) (<span id="sb-s-bet">0</span>)</button>
            <button id="btn-sb-bet-triple" class="minigame-btn" style="flex:1; border-color:var(--accent-gold);">ANY TRIPLE (<span id="sb-tr-bet">0</span>)</button>
            <button id="btn-sb-bet-big" class="minigame-btn" style="flex:1; border-color:var(--accent-pink);">BIG (11-17) (<span id="sb-b-bet">0</span>)</button>
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Session Profit: <span id="sb-profit-val" style="font-weight:bold;">0</span> Chips</div>
            <div style="color:var(--accent-gold);">Bet cost: ${isElectronic ? '5' : '10'} Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%; display:flex; gap:12px; justify-content:center;">
            <button id="btn-sb-clear" class="minigame-btn reset" style="flex:1;">Clear Bets</button>
            <button id="btn-sb-roll" class="minigame-btn action" style="flex:2;">ROLL DICE</button>
          </div>
        </div>
      `;

      const sBet = document.getElementById('sb-s-bet');
      const bBet = document.getElementById('sb-b-bet');
      const trBet = document.getElementById('sb-tr-bet');

      const addBet = (type) => {
        const cost = isElectronic ? 5 : 10;
        this.sicBoBets[type] = (this.sicBoBets[type] || 0) + cost;
        sBet.innerText = this.sicBoBets.small || 0;
        bBet.innerText = this.sicBoBets.big || 0;
        trBet.innerText = this.sicBoBets.triple_any || 0;
        window.Casino.SoundManager.playPlaceBet();
      };

      document.getElementById('btn-sb-bet-small').onclick = () => addBet('small');
      document.getElementById('btn-sb-bet-big').onclick = () => addBet('big');
      document.getElementById('btn-sb-bet-triple').onclick = () => addBet('triple_any');

      document.getElementById('btn-sb-clear').onclick = () => {
        this.sicBoBets = {};
        sBet.innerText = '0';
        bBet.innerText = '0';
        trBet.innerText = '0';
        window.Casino.SoundManager.playRemoveBet();
      };

      document.getElementById('btn-sb-roll').onclick = () => {
        const bets = [];
        Object.keys(this.sicBoBets).forEach(k => {
          if (this.sicBoBets[k] > 0) bets.push({ type: k, amount: this.sicBoBets[k] });
        });

        if (bets.length === 0) {
          this.logDebug("Please place at least one bet!", "error");
          return;
        }

        const totalCost = bets.reduce((sum, b) => sum + b.amount, 0);
        if (this.clientGame.chips < totalCost) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: isElectronic ? 'elec_sic_bo' : 'sic_bo',
          bets
        });
      };
    }

    handleSicBoPayout(payload) {
      const d1 = document.getElementById('sb-die1');
      const d2 = document.getElementById('sb-die2');
      const d3 = document.getElementById('sb-die3');
      const statusText = document.getElementById('sb-status-text');

      if (d1 && d2 && d3 && statusText) {
        d1.innerText = payload.dice[0];
        d2.innerText = payload.dice[1];
        d3.innerText = payload.dice[2];

        const outcomeText = `Sum: ${payload.sum} (${payload.isTriple ? 'TRIPLE' : (payload.sum >= 11 ? 'BIG' : 'SMALL')}).`;
        if (payload.netPayout > 0) {
          statusText.innerText = `${outcomeText} You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
          statusText.style.color = '#39ff14';
          window.Casino.SoundManager.playWin();
        } else if (payload.netPayout < 0) {
          statusText.innerText = `${outcomeText} You Lost ${Math.abs(payload.netPayout)} Chips.`;
          statusText.style.color = '#ff4d4d';
          window.Casino.SoundManager.playLose();
        } else {
          statusText.innerText = `${outcomeText} Push.`;
          statusText.style.color = '#00f0ff';
        }

        this.sessionProfit += payload.netPayout;
        const profitEl = document.getElementById('sb-profit-val');
        if (profitEl) {
          profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
          profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       CARIBBEAN STUD POKER CLIENT
       ========================================================================== */
    renderCaribbeanStud() {
      this.studBet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">DEALER HAND</div>
            <div id="cs-dealer-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">YOUR HAND</div>
            <div id="cs-player-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div id="cs-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place Ante bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Ante: <span id="cs-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="cs-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="cs-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-cs-fold" class="minigame-btn reset" style="display:none; flex:1;">FOLD</button>
              <button id="btn-cs-action" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('cs-bet-val');
      const actionBtn = document.getElementById('btn-cs-action');
      const foldBtn = document.getElementById('btn-cs-fold');
      const chipSelector = document.getElementById('cs-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.studBet = parseInt(chip.dataset.value);
          betVal.innerText = this.studBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      actionBtn.onclick = () => {
        if (actionBtn.innerText === 'DEAL') {
          if (this.clientGame.chips < this.studBet) {
            this.logDebug("Insufficient chips!", "error");
            return;
          }
          this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            tableId: this.activeTableId,
            gameType: 'caribbean_stud',
            action: 'deal',
            betAmount: this.studBet
          });
        } else {
          // Play action: cost is 2x Ante
          if (this.clientGame.chips < this.studBet * 2) {
            this.logDebug("Insufficient chips for Play bet!", "error");
            return;
          }
          this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            tableId: this.activeTableId,
            gameType: 'caribbean_stud',
            action: 'play'
          });
        }
      };

      foldBtn.onclick = () => {
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'caribbean_stud',
          action: 'fold'
        });
      };
    }

    handleCaribbeanStudPayout(payload) {
      const pCards = document.getElementById('cs-player-cards');
      const dCards = document.getElementById('cs-dealer-cards');
      const statusText = document.getElementById('cs-status-text');
      const actionBtn = document.getElementById('btn-cs-action');
      const foldBtn = document.getElementById('btn-cs-fold');

      if (pCards && dCards && statusText && actionBtn && foldBtn) {
        pCards.innerHTML = payload.playerHand.map(c => this.renderCardHTML(c)).join('');
        dCards.innerHTML = payload.dealerHand.map(c => this.renderCardHTML(c)).join('');

        if (payload.state === 'playing') {
          statusText.innerText = "View your cards! Place PLAY bet (2x Ante) or FOLD.";
          actionBtn.innerText = 'PLAY (BET 2X)';
          foldBtn.style.display = 'block';
        } else if (payload.state === 'resolved') {
          actionBtn.innerText = 'DEAL';
          foldBtn.style.display = 'none';

          if (payload.outcome === 'win') {
            statusText.innerText = `You Won! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'dealer_no_qualify') {
            statusText.innerText = `Dealer did not qualify! Ante wins +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#00f0ff';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'fold') {
            statusText.innerText = "Folded. Lost Ante bet.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          } else {
            statusText.innerText = "Dealer wins. Lost all bets.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('cs-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       BIG SIX WHEEL CLIENT
       ========================================================================== */
    drawBigSixWheel(angle) {
      const canvas = document.getElementById('bs-wheel-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = cx - 6;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const segments = [
        { label: '$1', color: '#1a1a2e', textColor: '#ffffff' },
        { label: '$2', color: '#00f0ff', textColor: '#000000' },
        { label: '$5', color: '#39ff14', textColor: '#000000' },
        { label: '$10', color: '#ffaa00', textColor: '#000000' },
        { label: '$20', color: '#ff007f', textColor: '#ffffff' },
        { label: 'JOKER', color: '#e64dff', textColor: '#ffffff' },
        { label: 'LOGO', color: '#ffd700', textColor: '#000000' }
      ];
      
      const numSlices = 24; 
      const sliceAngle = (Math.PI * 2) / numSlices;
      
      for (let i = 0; i < numSlices; i++) {
        const seg = segments[i % segments.length];
        const start = angle + i * sliceAngle;
        const end = start + sliceAngle;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#222';
        ctx.stroke();
        
        // Draw label text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = seg.textColor;
        ctx.font = 'bold 8px "Outfit", sans-serif';
        ctx.fillText(seg.label, r - 6, 0);
        ctx.restore();
      }
      
      // Center hub
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Top pointer needle pointing down
      ctx.beginPath();
      ctx.moveTo(cx, 1);
      ctx.lineTo(cx - 5, 10);
      ctx.lineTo(cx + 5, 10);
      ctx.closePath();
      ctx.fillStyle = '#ff0000';
      ctx.fill();
    }

    renderBigSix() {
      this.bigSixBets = {};
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:8px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:16px; font-weight:bold; color:var(--accent-gold); margin-bottom:2px;" id="bs-wheel-display">🎡 WHEEL OF FORTUNE</div>
          <canvas id="bs-wheel-canvas" width="150" height="150" style="margin:2px 0; border: 4px solid var(--accent-gold); border-radius: 50%; box-shadow: 0 0 15px rgba(255,215,0,0.3); background:#111;"></canvas>
          <div id="bs-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bets on $1, $2, $5, $10, $20, JOKER, or LOGO!
          </div>
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; width:100%; margin:8px 0;">
            <button id="btn-bs-bet-1" class="minigame-btn" style="border-color:#fff;">$1 (<span id="bs-1-bet">0</span>)</button>
            <button id="btn-bs-bet-2" class="minigame-btn" style="border-color:#00f0ff;">$2 (<span id="bs-2-bet">0</span>)</button>
            <button id="btn-bs-bet-5" class="minigame-btn" style="border-color:#39ff14;">$5 (<span id="bs-5-bet">0</span>)</button>
            <button id="btn-bs-bet-10" class="minigame-btn" style="border-color:var(--accent-gold);">$10 (<span id="bs-10-bet">0</span>)</button>
            <button id="btn-bs-bet-20" class="minigame-btn" style="border-color:var(--accent-pink); grid-column:span 2;">$20 (<span id="bs-20-bet">0</span>)</button>
            <button id="btn-bs-bet-joker" class="minigame-btn" style="border-color:#e64dff;">Joker (<span id="bs-jk-bet">0</span>)</button>
            <button id="btn-bs-bet-logo" class="minigame-btn" style="border-color:#ffaa00;">Logo (<span id="bs-lg-bet">0</span>)</button>
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Session Profit: <span id="bs-profit-val" style="font-weight:bold;">0</span> Chips</div>
            <div style="color:var(--accent-gold);">Bet cost: 10 Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%; display:flex; gap:12px; justify-content:center;">
            <button id="btn-bs-clear" class="minigame-btn reset" style="flex:1;">Clear Bets</button>
            <button id="btn-bs-spin" class="minigame-btn action" style="flex:2;">SPIN WHEEL</button>
          </div>
        </div>
      `;

      this.wheelRotation = 0;
      setTimeout(() => this.drawBigSixWheel(0), 50);

      const b1 = document.getElementById('bs-1-bet');
      const b2 = document.getElementById('bs-2-bet');
      const b5 = document.getElementById('bs-5-bet');
      const b10 = document.getElementById('bs-10-bet');
      const b20 = document.getElementById('bs-20-bet');
      const bJk = document.getElementById('bs-jk-bet');
      const bLg = document.getElementById('bs-lg-bet');

      const addBet = (type) => {
        this.bigSixBets[type] = (this.bigSixBets[type] || 0) + 10;
        b1.innerText = this.bigSixBets['$1'] || 0;
        b2.innerText = this.bigSixBets['$2'] || 0;
        b5.innerText = this.bigSixBets['$5'] || 0;
        b10.innerText = this.bigSixBets['$10'] || 0;
        b20.innerText = this.bigSixBets['$20'] || 0;
        bJk.innerText = this.bigSixBets.joker || 0;
        bLg.innerText = this.bigSixBets.logo || 0;
        window.Casino.SoundManager.playPlaceBet();
      };

      document.getElementById('btn-bs-bet-1').onclick = () => addBet('$1');
      document.getElementById('btn-bs-bet-2').onclick = () => addBet('$2');
      document.getElementById('btn-bs-bet-5').onclick = () => addBet('$5');
      document.getElementById('btn-bs-bet-10').onclick = () => addBet('$10');
      document.getElementById('btn-bs-bet-20').onclick = () => addBet('$20');
      document.getElementById('btn-bs-bet-joker').onclick = () => addBet('joker');
      document.getElementById('btn-bs-bet-logo').onclick = () => addBet('logo');

      document.getElementById('btn-bs-clear').onclick = () => {
        this.bigSixBets = {};
        b1.innerText = '0';
        b2.innerText = '0';
        b5.innerText = '0';
        b10.innerText = '0';
        b20.innerText = '0';
        bJk.innerText = '0';
        bLg.innerText = '0';
        window.Casino.SoundManager.playRemoveBet();
      };

      document.getElementById('btn-bs-spin').onclick = () => {
        const bets = [];
        Object.keys(this.bigSixBets).forEach(k => {
          if (this.bigSixBets[k] > 0) bets.push({ type: k, amount: this.bigSixBets[k] });
        });

        if (bets.length === 0) {
          this.logDebug("Please place at least one bet!", "error");
          return;
        }

        const totalCost = bets.reduce((sum, b) => sum + b.amount, 0);
        if (this.clientGame.chips < totalCost) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'big_six',
          bets
        });
      };
    }

    handleBigSixPayout(payload) {
      const statusText = document.getElementById('bs-status-text');
      const spinBtn = document.getElementById('btn-bs-spin');
      const clearBtn = document.getElementById('btn-bs-clear');
      
      if (statusText) {
        if (spinBtn) spinBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
        statusText.innerText = "Spinning wheel...";
        statusText.style.color = '#fff';

        const startAngle = this.wheelRotation || 0;
        const spinDuration = 3000;
        let startTime = null;

        // Force a nice random rotation that lands smoothly
        const totalRotation = Math.PI * 2 * 3 + (Math.random() * Math.PI * 2);
        const targetRotation = startAngle + totalRotation;

        const animate = (timestamp) => {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / spinDuration, 1);

          // easeOutQuad
          const ease = 1 - (1 - progress) * (1 - progress);
          this.wheelRotation = startAngle + (targetRotation - startAngle) * ease;
          this.drawBigSixWheel(this.wheelRotation);

          if (progress < 1) {
            if (Math.floor(this.wheelRotation * 10) % 2 === 0) {
              window.Casino.SoundManager.playBeep();
            }
            requestAnimationFrame(animate);
          } else {
            if (spinBtn) spinBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;

            const outcomeText = `Wheel landed on: ${payload.winSegment.toUpperCase()}.`;
            if (payload.netPayout > 0) {
              statusText.innerText = `${outcomeText} You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
              statusText.style.color = '#39ff14';
              window.Casino.SoundManager.playWin();
            } else {
              statusText.innerText = `${outcomeText} You Lost.`;
              statusText.style.color = '#ff4d4d';
              window.Casino.SoundManager.playLose();
            }

            this.sessionProfit += payload.netPayout;
            const profitEl = document.getElementById('bs-profit-val');
            if (profitEl) {
              profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
              profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
            }
            if (payload.researchPoints !== undefined) this.clientGame.state.researchPoints = payload.researchPoints;
            if (payload.starRating !== undefined) this.clientGame.state.starRating = payload.starRating;
            if (payload.chips !== undefined) this.clientGame.chips = payload.chips;
            this.updateBalance();
          }
        };
        requestAnimationFrame(animate);
      }
    }

    /* ==========================================================================
       LET IT RIDE POKER CLIENT
       ========================================================================== */
    renderLetItRide() {
      this.letItRideBet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">COMMUNITY CARDS</div>
            <div id="lr-community-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">YOUR HAND</div>
            <div id="lr-player-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div id="lr-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bets (3x Ante) to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Single Bet: <span id="lr-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips (x3 total)</div>
            <div>Bets Active: <span id="lr-active-bets" style="color:#00f0ff; font-weight:bold;">1, 2, 3</span></div>
            <div>Session Profit: <span id="lr-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="lr-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-lr-pull" class="minigame-btn reset" style="display:none; flex:1;">PULL BET</button>
              <button id="btn-lr-ride" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('lr-bet-val');
      const rideBtn = document.getElementById('btn-lr-ride');
      const pullBtn = document.getElementById('btn-lr-pull');
      const chipSelector = document.getElementById('lr-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.letItRideBet = parseInt(chip.dataset.value);
          betVal.innerText = this.letItRideBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      rideBtn.onclick = () => {
        const curText = rideBtn.innerText;
        let action = 'deal';
        if (curText === 'LET IT RIDE') action = 'ride';

        if (action === 'deal' && this.clientGame.chips < this.letItRideBet * 3) {
          this.logDebug("Insufficient chips for 3x bets!", "error");
          return;
        }

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'let_it_ride',
          action,
          betAmount: this.letItRideBet
        });
      };

      pullBtn.onclick = () => {
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'let_it_ride',
          action: 'pull'
        });
      };
    }

    handleLetItRidePayout(payload) {
      const pCards = document.getElementById('lr-player-cards');
      const cCards = document.getElementById('lr-community-cards');
      const statusText = document.getElementById('lr-status-text');
      const activeBets = document.getElementById('lr-active-bets');
      const rideBtn = document.getElementById('btn-lr-ride');
      const pullBtn = document.getElementById('btn-lr-pull');

      if (pCards && cCards && statusText && activeBets && rideBtn && pullBtn) {
        pCards.innerHTML = payload.playerHand.map(c => this.renderCardHTML(c)).join('');
        cCards.innerHTML = payload.community.map(c => this.renderCardHTML(c)).join('');

        const betState = payload.activeBets.map((b, i) => b ? (i+1) : '').filter(x => x).join(', ');
        activeBets.innerText = betState || 'None';

        if (payload.state === 'pull1') {
          statusText.innerText = "Hole cards dealt! PULL your 1st bet or LET IT RIDE.";
          rideBtn.innerText = 'LET IT RIDE';
          pullBtn.style.display = 'block';
        } else if (payload.state === 'pull2') {
          statusText.innerText = "1st Community card revealed! PULL your 2nd bet or LET IT RIDE.";
          rideBtn.innerText = 'LET IT RIDE';
          pullBtn.style.display = 'block';
        } else if (payload.state === 'resolved') {
          rideBtn.innerText = 'DEAL';
          pullBtn.style.display = 'none';

          if (payload.odds > 0) {
            statusText.innerText = `You Won! Hand Rank pays: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else {
            statusText.innerText = "No winning hand combination. Lost active bets.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('lr-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       RED DOG CLIENT
       ========================================================================== */
    renderRedDog() {
      this.redDogBet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">BOARD CARDS (1, SPREAD/3RD, 2)</div>
            <div id="rd-cards" style="display:flex; gap:12px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div id="rd-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="rd-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div id="rd-spread-val" style="color:#00f0ff;">Spread: -</div>
            <div>Session Profit: <span id="rd-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="rd-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-rd-raise" class="minigame-btn action" style="display:none; flex:1;">RAISE (2X)</button>
              <button id="btn-rd-stand" class="minigame-btn reset" style="display:none; flex:1;">STAND</button>
              <button id="btn-rd-deal" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('rd-bet-val');
      const dealBtn = document.getElementById('btn-rd-deal');
      const standBtn = document.getElementById('btn-rd-stand');
      const raiseBtn = document.getElementById('btn-rd-raise');
      const chipSelector = document.getElementById('rd-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.redDogBet = parseInt(chip.dataset.value);
          betVal.innerText = this.redDogBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      dealBtn.onclick = () => {
        if (this.clientGame.chips < this.redDogBet) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'red_dog',
          action: 'deal',
          betAmount: this.redDogBet
        });
      };

      standBtn.onclick = () => {
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'red_dog',
          action: 'stand'
        });
      };

      raiseBtn.onclick = () => {
        if (this.clientGame.chips < this.redDogBet) {
          this.logDebug("Insufficient chips to double bet!", "error");
          return;
        }
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'red_dog',
          action: 'raise'
        });
      };
    }

    handleRedDogPayout(payload) {
      const rdCards = document.getElementById('rd-cards');
      const statusText = document.getElementById('rd-status-text');
      const spreadVal = document.getElementById('rd-spread-val');
      const dealBtn = document.getElementById('btn-rd-deal');
      const standBtn = document.getElementById('btn-rd-stand');
      const raiseBtn = document.getElementById('btn-rd-raise');

      if (rdCards && statusText && spreadVal && dealBtn && standBtn && raiseBtn) {
        if (payload.state === 'spread') {
          dealBtn.style.display = 'none';
          standBtn.style.display = 'block';
          raiseBtn.style.display = 'block';

          spreadVal.innerText = `Spread: ${payload.spread}`;
          rdCards.innerHTML = `
            ${this.renderCardHTML(payload.c1)}
            <div class="card face-down" style="width: 55px; height: 80px; border-radius: 6px; border: 2px dashed #00f0ff; display:flex; align-items:center; justify-content:center; font-size:10px;">3RD</div>
            ${this.renderCardHTML(payload.c2)}
          `;
          statusText.innerText = `Cards have spread of ${payload.spread}. STAND or RAISE (doubles bet)?`;
        } else if (payload.state === 'resolved') {
          dealBtn.style.display = 'block';
          standBtn.style.display = 'none';
          raiseBtn.style.display = 'none';

          if (payload.c3) {
            rdCards.innerHTML = `
              ${this.renderCardHTML(payload.c1)}
              ${this.renderCardHTML(payload.c3)}
              ${this.renderCardHTML(payload.c2)}
            `;
          } else {
            rdCards.innerHTML = `
              ${this.renderCardHTML(payload.c1)}
              ${this.renderCardHTML(payload.c2)}
            `;
          }

          if (payload.outcome === 'win' || payload.outcome === 'triple') {
            statusText.innerText = `You Won! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'push') {
            statusText.innerText = "Consecutive cards. Push.";
            statusText.style.color = '#00f0ff';
          } else {
            statusText.innerText = "Lost. Card value not in spread.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('rd-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       SPANISH 21 CLIENT
       ========================================================================== */
    renderSpanish21() {
      this.spanish21Bet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">DEALER HAND</div>
            <div id="sp-dealer-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">YOUR HAND</div>
            <div id="sp-player-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center;">-</div>
          </div>
          <div id="sp-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="sp-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="sp-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="sp-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-sp-hit" class="minigame-btn" style="display:none; flex:1; border-color:#00f0ff;">HIT</button>
              <button id="btn-sp-stand" class="minigame-btn" style="display:none; flex:1; border-color:var(--accent-pink);">STAND</button>
              <button id="btn-sp-deal" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('sp-bet-val');
      const dealBtn = document.getElementById('btn-sp-deal');
      const standBtn = document.getElementById('btn-sp-stand');
      const hitBtn = document.getElementById('btn-sp-hit');
      const chipSelector = document.getElementById('sp-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.spanish21Bet = parseInt(chip.dataset.value);
          betVal.innerText = this.spanish21Bet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      dealBtn.onclick = () => {
        if (this.clientGame.chips < this.spanish21Bet) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'spanish_21',
          action: 'deal',
          betAmount: this.spanish21Bet
        });
      };

      hitBtn.onclick = () => {
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'spanish_21',
          action: 'hit'
        });
      };

      standBtn.onclick = () => {
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'spanish_21',
          action: 'stand'
        });
      };
    }

    handleSpanish21Payout(payload) {
      const pCards = document.getElementById('sp-player-cards');
      const dCards = document.getElementById('sp-dealer-cards');
      const statusText = document.getElementById('sp-status-text');
      const dealBtn = document.getElementById('btn-sp-deal');
      const standBtn = document.getElementById('btn-sp-stand');
      const hitBtn = document.getElementById('btn-sp-hit');

      if (pCards && dCards && statusText && dealBtn && standBtn && hitBtn) {
        pCards.innerHTML = payload.playerHand.map(c => this.renderCardHTML(c)).join('');
        dCards.innerHTML = payload.dealerHand.map(c => this.renderCardHTML(c)).join('');

        if (payload.state === 'playing') {
          dealBtn.style.display = 'none';
          standBtn.style.display = 'block';
          hitBtn.style.display = 'block';
          statusText.innerText = "Choose Hit or Stand. (No 10s in deck, player 21 always wins).";
        } else if (payload.state === 'resolved') {
          dealBtn.style.display = 'block';
          standBtn.style.display = 'none';
          hitBtn.style.display = 'none';

          if (payload.outcome === 'win' || payload.outcome === 'blackjack') {
            statusText.innerText = `You Won! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'push') {
            statusText.innerText = "Push.";
            statusText.style.color = '#00f0ff';
          } else {
            statusText.innerText = `Dealer wins (${payload.outcome === 'bust' ? 'Busted' : 'Lost'}).`;
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('sp-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       CASINO WAR CLIENT
       ========================================================================== */
    renderCasinoWar() {
      this.warBet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; gap:16px; justify-content:center; width:100%;">
            <div style="text-align:center;">
              <div style="font-size:11px; color:#aaa;">DEALER CARD</div>
              <div id="wr-dealer-cards" style="display:flex; gap:6px; min-height:80px; align-items:center; justify-content:center;">-</div>
            </div>
            <div style="font-size:24px; color:rgba(255,255,255,0.2); align-self:center;">VS</div>
            <div style="text-align:center;">
              <div style="font-size:11px; color:#aaa;">YOUR CARD</div>
              <div id="wr-player-cards" style="display:flex; gap:6px; min-height:80px; align-items:center; justify-content:center;">-</div>
            </div>
          </div>
          <div id="wr-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="wr-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="wr-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="wr-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-wr-war" class="minigame-btn action" style="display:none; flex:1;">GO TO WAR</button>
              <button id="btn-wr-surrender" class="minigame-btn reset" style="display:none; flex:1;">SURRENDER</button>
              <button id="btn-wr-deal" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('wr-bet-val');
      const dealBtn = document.getElementById('btn-wr-deal');
      const warBtn = document.getElementById('btn-wr-war');
      const surrenderBtn = document.getElementById('btn-wr-surrender');
      const chipSelector = document.getElementById('wr-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.warBet = parseInt(chip.dataset.value);
          betVal.innerText = this.warBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      dealBtn.onclick = () => {
        if (this.clientGame.chips < this.warBet) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'casino_war',
          action: 'deal',
          betAmount: this.warBet
        });
      };

      warBtn.onclick = () => {
        if (this.clientGame.chips < this.warBet) {
          this.logDebug("Insufficient chips to go to War!", "error");
          return;
        }
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'casino_war',
          action: 'war'
        });
      };

      surrenderBtn.onclick = () => {
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'casino_war',
          action: 'surrender'
        });
      };
    }

    handleCasinoWarPayout(payload) {
      const pCards = document.getElementById('wr-player-cards');
      const dCards = document.getElementById('wr-dealer-cards');
      const statusText = document.getElementById('wr-status-text');
      const dealBtn = document.getElementById('btn-wr-deal');
      const warBtn = document.getElementById('btn-wr-war');
      const surrenderBtn = document.getElementById('btn-wr-surrender');

      if (pCards && dCards && statusText && dealBtn && warBtn && surrenderBtn) {
        if (payload.state === 'tie') {
          dealBtn.style.display = 'none';
          warBtn.style.display = 'block';
          surrenderBtn.style.display = 'block';

          pCards.innerHTML = this.renderCardHTML(payload.pCard);
          dCards.innerHTML = this.renderCardHTML(payload.dCard);
          statusText.innerText = "Tie card! Go to War (adds matching bet) or Surrender?";
        } else if (payload.state === 'resolved') {
          dealBtn.style.display = 'block';
          warBtn.style.display = 'none';
          surrenderBtn.style.display = 'none';

          if (payload.pCard2) {
            pCards.innerHTML = `
              <div style="font-size:10px; color:#aaa;">Ante</div>
              ${this.renderCardHTML(payload.pCard)}
              <div style="font-size:10px; color:#aaa; margin-top:4px;">War</div>
              ${this.renderCardHTML(payload.pCard2)}
            `;
            dCards.innerHTML = `
              <div style="font-size:10px; color:#aaa;">Ante</div>
              ${this.renderCardHTML(payload.dCard)}
              <div style="font-size:10px; color:#aaa; margin-top:4px;">War</div>
              ${this.renderCardHTML(payload.dCard2)}
            `;
          } else {
            pCards.innerHTML = this.renderCardHTML(payload.pCard);
            dCards.innerHTML = this.renderCardHTML(payload.dCard);
          }

          if (payload.outcome === 'win' || payload.outcome === 'win_war') {
            statusText.innerText = `You Won! Payout: +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else if (payload.outcome === 'surrender') {
            statusText.innerText = "Surrendered. Lost half bet.";
            statusText.style.color = '#00f0ff';
          } else {
            statusText.innerText = "Lost. High card beats player.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('wr-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       VIDEO POKER CLIENT
       ========================================================================== */
    renderVideoPoker() {
      this.vpBet = 10;
      this.heldIndices = [];
      this.vpCards = [];

      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center; width:100%;">
            <div style="font-size:11px; color:#aaa; margin-bottom:4px;">YOUR 5 CARDS (Click cards to HOLD)</div>
            <div id="vp-cards" style="display:flex; gap:6px; justify-content:center; min-height:80px; align-items:center; cursor:pointer;">-</div>
          </div>
          <div id="vp-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bet to deal hand!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="vp-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="vp-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="vp-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-vp-action" class="minigame-btn action" style="flex:2;">DEAL</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('vp-bet-val');
      const actionBtn = document.getElementById('btn-vp-action');
      const chipSelector = document.getElementById('vp-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.vpBet = parseInt(chip.dataset.value);
          betVal.innerText = this.vpBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      actionBtn.onclick = () => {
        if (actionBtn.innerText === 'DEAL') {
          if (this.clientGame.chips < this.vpBet) {
            this.logDebug("Insufficient chips!", "error");
            return;
          }
          this.heldIndices = [];
          this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            tableId: this.activeTableId,
            gameType: 'video_poker',
            action: 'deal',
            betAmount: this.vpBet
          });
        } else {
          this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
            tableId: this.activeTableId,
            gameType: 'video_poker',
            action: 'draw',
            holdIndices: this.heldIndices
          });
        }
      };
    }

    handleVideoPokerPayout(payload) {
      const cardsEl = document.getElementById('vp-cards');
      const statusText = document.getElementById('vp-status-text');
      const actionBtn = document.getElementById('btn-vp-action');

      if (cardsEl && statusText && actionBtn) {
        if (payload.state === 'draw') {
          this.vpCards = payload.playerHand;
          actionBtn.innerText = 'DRAW';
          statusText.innerText = "Select cards to HOLD, then click DRAW.";
          statusText.style.color = '#fff';

          const renderSelectable = () => {
            cardsEl.innerHTML = this.vpCards.map((c, idx) => {
              const isHeld = this.heldIndices.includes(idx);
              const cardHTML = this.renderCardHTML(c);
              return `<div data-index="${idx}" style="position:relative;">
                ${cardHTML}
                <div style="position:absolute; bottom:-4px; left:0; width:100%; text-align:center; font-size:8px; font-weight:bold; color:${isHeld?'#39ff14':'#777'};">${isHeld?'[ HELD ]':''}</div>
              </div>`;
            }).join('');

            Array.from(cardsEl.children).forEach(el => {
              el.onclick = () => {
                const idx = parseInt(el.dataset.index);
                if (this.heldIndices.includes(idx)) {
                  this.heldIndices = this.heldIndices.filter(x => x !== idx);
                } else {
                  this.heldIndices.push(idx);
                }
                renderSelectable();
              };
            });
          };

          renderSelectable();
        } else if (payload.state === 'resolved') {
          actionBtn.innerText = 'DEAL';
          cardsEl.innerHTML = payload.playerHand.map(c => this.renderCardHTML(c)).join('');

          if (payload.odds > 0) {
            statusText.innerText = `${payload.outcome}! You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
            statusText.style.color = '#39ff14';
            window.Casino.SoundManager.playWin();
          } else {
            statusText.innerText = "Lost bet. No winning hand combination.";
            statusText.style.color = '#ff4d4d';
            window.Casino.SoundManager.playLose();
          }

          this.sessionProfit += payload.netPayout;
          const profitEl = document.getElementById('vp-profit-val');
          if (profitEl) {
            profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
            profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
          }
        }
      }
      this.updateBalance();
    }

    /* ==========================================================================
       PLINKO CLIENT
       ========================================================================== */
    renderPlinko() {
      this.plinkoBet = 10;
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:11px; color:#aaa; margin-bottom:4px;">PLINKO PEGS BOARD</div>
          <div id="pk-board" style="position:relative; width:200px; height:180px; background:#111; border-radius:8px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;">
            <!-- Render pegs array -->
            <div style="display:flex; flex-direction:column; justify-content:space-between; height:100%; padding:10px 0;">
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ● ● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ● ● ● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ● ● ● ● ● ●</div>
              <div style="display:flex; justify-content:center; gap:16px; color:rgba(255,255,255,0.15); font-size: 8px;">● ● ● ● ● ● ● ● ● ●</div>
              <div style="position:relative; width:100%; height:14px; border-top:1px dashed rgba(255,255,255,0.1); font-weight:bold; color:var(--accent-gold); font-size:8px;">
                <span style="position:absolute; left:3px; width:18px; text-align:center;">5x</span>
                <span style="position:absolute; left:25px; width:18px; text-align:center;">2x</span>
                <span style="position:absolute; left:47px; width:18px; text-align:center;">0.5x</span>
                <span style="position:absolute; left:69px; width:18px; text-align:center;">0.2x</span>
                <span style="position:absolute; left:91px; width:18px; text-align:center;">0x</span>
                <span style="position:absolute; left:113px; width:18px; text-align:center;">0.2x</span>
                <span style="position:absolute; left:135px; width:18px; text-align:center;">0.5x</span>
                <span style="position:absolute; left:157px; width:18px; text-align:center;">2x</span>
                <span style="position:absolute; left:179px; width:18px; text-align:center;">5x</span>
              </div>
            </div>
            <!-- Dynamic ball overlay -->
            <div id="pk-ball" style="display:none; position:absolute; width:8px; height:8px; border-radius:50%; background:#ffd700; left:96px; top:4px; box-shadow:0 0 8px #ffd700; z-index: 5;"></div>
          </div>
          <div id="pk-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Place bet and click DROP BALL!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="pk-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="pk-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="pk-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <button id="btn-pk-drop" class="minigame-btn action" style="width:100%; font-weight:bold; font-size:14px; cursor:pointer;">DROP BALL</button>
          </div>
        </div>
      `;

      const betVal = document.getElementById('pk-bet-val');
      const dropBtn = document.getElementById('btn-pk-drop');
      const chipSelector = document.getElementById('pk-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.plinkoBet = parseInt(chip.dataset.value);
          betVal.innerText = this.plinkoBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      dropBtn.onclick = () => {
        if (this.clientGame.chips < this.plinkoBet) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }
        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'plinko',
          betAmount: this.plinkoBet
        });
      };
    }

    handlePlinkoPayout(payload) {
      const ball = document.getElementById('pk-ball');
      const statusText = document.getElementById('pk-status-text');
      const dropBtn = document.getElementById('btn-pk-drop');

      if (ball && statusText && dropBtn) {
        dropBtn.disabled = true;
        ball.style.display = 'block';

        // Animate the drop
        let step = 0;
        let x = 96;
        let y = 10;
        ball.style.left = `${x}px`;
        ball.style.top = `${y}px`;

        const interval = setInterval(() => {
          if (step < payload.path.length) {
            x += payload.path[step] * 11;
            y += 18;
            ball.style.left = `${x}px`;
            ball.style.top = `${y}px`;
            step++;
            window.Casino.SoundManager.playBeep();
          } else {
            clearInterval(interval);
            dropBtn.disabled = false;

            const netVal = payload.netPayout;
            if (netVal >= 0) {
              statusText.innerText = `Landed on ${payload.multiplier}x slot! Won +${netVal} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
              statusText.style.color = '#39ff14';
              window.Casino.SoundManager.playWin();
            } else {
              statusText.innerText = `Landed on ${payload.multiplier}x slot! Net Loss: ${Math.abs(netVal)} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
              statusText.style.color = '#ff4d4d';
              window.Casino.SoundManager.playLose();
            }

            this.sessionProfit += payload.netPayout;
            const profitEl = document.getElementById('pk-profit-val');
            if (profitEl) {
              profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
              profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
            }
            if (payload.researchPoints !== undefined) this.clientGame.state.researchPoints = payload.researchPoints;
            if (payload.starRating !== undefined) this.clientGame.state.starRating = payload.starRating;
            if (payload.chips !== undefined) this.clientGame.chips = payload.chips;
            this.updateBalance();
          }
        }, 150);
      }
    }

    /* ==========================================================================
       LOTTERY CLIENT
       ========================================================================== */
    renderLottery() {
      this.lotteryBet = 10;
      this.selectedNumbers = [];
      this.modalBody.innerHTML = `
        <div class="card-game-container" style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; max-width:600px; margin:0 auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <!-- Bouncing ball lottery drum -->
          <div id="lt-drum" style="position:relative; width:80px; height:80px; border-radius:50%; border:3px dashed var(--accent-gold); margin:4px 0; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; overflow:hidden; transition: transform 0.1s linear;">
            <div class="drum-ball" style="position:absolute; width:10px; height:10px; border-radius:50%; background:#ffd700; left:20%; top:30%;"></div>
            <div class="drum-ball" style="position:absolute; width:10px; height:10px; border-radius:50%; background:#00f0ff; left:40%; top:60%;"></div>
            <div class="drum-ball" style="position:absolute; width:10px; height:10px; border-radius:50%; background:#ff007f; left:60%; top:20%;"></div>
            <div class="drum-ball" style="position:absolute; width:10px; height:10px; border-radius:50%; background:#39ff14; left:70%; top:50%;"></div>
            <div class="drum-ball" style="position:absolute; width:10px; height:10px; border-radius:50%; background:#e64dff; left:30%; top:25%;"></div>
          </div>
          <div style="font-size:11px; color:#aaa; margin-bottom:4px;">SELECT 5 NUMBERS (1-20)</div>
          <div id="lt-board" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; width:100%;">
            <!-- 1 to 20 buttons -->
            ${Array.from({ length: 20 }, (_, i) => i + 1).map(n => `
              <button class="minigame-btn number-btn" style="padding:6px; font-size:11px;" data-number="${n}">${n}</button>
            `).join('')}
          </div>
          <div id="lt-results" style="display:flex; gap:8px; min-height:24px; align-items:center; justify-content:center;">-</div>
          <div id="lt-status-text" style="font-size:13px; font-weight:bold; text-align:center; color:#fff; height:18px;">
            Choose 5 numbers and click BUY TICKET!
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:8px; font-size:11px;">
            <div>Bet: <span id="lt-bet-val" style="color:var(--accent-gold); font-weight:bold;">10</span> Chips</div>
            <div>Session Profit: <span id="lt-profit-val" style="font-weight:bold;">0</span> Chips</div>
          </div>
          <div class="controls-wrapper" style="width:100%;">
            <div class="chip-selector" id="lt-chip-selector" style="justify-content:center; gap:8px; margin-bottom:8px;">
              <div class="picker-chip active" data-value="10">10</div>
              <div class="picker-chip" data-value="25">25</div>
              <div class="picker-chip" data-value="100">100</div>
            </div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button id="btn-lt-buy" class="minigame-btn action" style="flex:2;">BUY TICKET</button>
            </div>
          </div>
        </div>
      `;

      const betVal = document.getElementById('lt-bet-val');
      const buyBtn = document.getElementById('btn-lt-buy');
      const board = document.getElementById('lt-board');
      const chipSelector = document.getElementById('lt-chip-selector');

      Array.from(chipSelector.children).forEach(chip => {
        chip.onclick = () => {
          Array.from(chipSelector.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.lotteryBet = parseInt(chip.dataset.value);
          betVal.innerText = this.lotteryBet;
          window.Casino.SoundManager.playPlaceBet();
        };
      });

      const renderBoard = () => {
        Array.from(board.children).forEach(btn => {
          const val = parseInt(btn.dataset.number);
          if (this.selectedNumbers.includes(val)) {
            btn.style.background = '#00f0ff';
            btn.style.color = '#000';
            btn.style.borderColor = '#00f0ff';
          } else {
            btn.style.background = 'none';
            btn.style.color = '#fff';
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
          }

          btn.onclick = () => {
            if (this.selectedNumbers.includes(val)) {
              this.selectedNumbers = this.selectedNumbers.filter(x => x !== val);
            } else {
              if (this.selectedNumbers.length < 5) {
                this.selectedNumbers.push(val);
              }
            }
            renderBoard();
            window.Casino.SoundManager.playBeep();
          };
        });
      };

      renderBoard();

      buyBtn.onclick = () => {
        if (this.selectedNumbers.length !== 5) {
          this.logDebug("You must select exactly 5 numbers!", "error");
          return;
        }
        if (this.clientGame.chips < this.lotteryBet) {
          this.logDebug("Insufficient chips!", "error");
          return;
        }

        this.clientGame.sendAction(window.Casino.Protocol.Commands.PLAY_MINIGAME, {
          tableId: this.activeTableId,
          gameType: 'lottery',
          betAmount: this.lotteryBet,
          selectedNumbers: this.selectedNumbers
        });
      };
    }

    handleLotteryPayout(payload) {
      const resultsEl = document.getElementById('lt-results');
      const statusText = document.getElementById('lt-status-text');
      const buyBtn = document.getElementById('btn-lt-buy');
      const drum = document.getElementById('lt-drum');

      if (resultsEl && statusText) {
        if (buyBtn) buyBtn.disabled = true;
        statusText.innerText = "Drawing numbers from drum...";
        statusText.style.color = '#fff';

        let cycles = 0;
        const interval = setInterval(() => {
          // Generate 5 random numbers for preview
          const randNums = [];
          while (randNums.length < 5) {
            const r = Math.floor(Math.random() * 20) + 1;
            if (!randNums.includes(r)) randNums.push(r);
          }

          if (drum) {
            drum.style.transform = `rotate(${cycles * 30}deg)`;
            const balls = drum.querySelectorAll('.drum-ball');
            balls.forEach(b => {
              b.style.left = `${15 + Math.random() * 60}%`;
              b.style.top = `${15 + Math.random() * 60}%`;
            });
          }

          resultsEl.innerHTML = randNums.map(n => {
            const matched = this.selectedNumbers.includes(n);
            return `<div style="width:24px; height:24px; border-radius:50%; background:${matched?'rgba(57,255,20,0.5)':'rgba(255,77,77,0.5)'}; color:#fff; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:11px;">${n}</div>`;
          }).join('');
          
          window.Casino.SoundManager.playBeep();
          cycles++;

          if (cycles >= 12) {
            clearInterval(interval);
            if (buyBtn) buyBtn.disabled = false;

            resultsEl.innerHTML = payload.winningNumbers.map(n => {
              const matched = this.selectedNumbers.includes(n);
              return `<div style="width:24px; height:24px; border-radius:50%; background:${matched?'#39ff14':'#ff4d4d'}; color:#000; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:11px; box-shadow: 0 0 8px ${matched?'#39ff14':'#ff4d4d'};">${n}</div>`;
            }).join('');

            const outcomeText = `Drew winning numbers. Matches: ${payload.matches}.`;
            if (payload.multiplier > 0) {
              statusText.innerText = `${outcomeText} Pays ${payload.multiplier}x! You Won +${payload.netPayout} Chips${payload.rpAwarded > 0 ? ' (+' + payload.rpAwarded + ' 🧪)' : ''}!`;
              statusText.style.color = '#39ff14';
              window.Casino.SoundManager.playWin();
            } else {
              statusText.innerText = `${outcomeText} Lost bet.`;
              statusText.style.color = '#ff4d4d';
              window.Casino.SoundManager.playLose();
            }

            this.sessionProfit += payload.netPayout;
            const profitEl = document.getElementById('lt-profit-val');
            if (profitEl) {
              profitEl.innerText = (this.sessionProfit >= 0 ? '+' : '') + this.sessionProfit.toLocaleString();
              profitEl.style.color = this.sessionProfit > 0 ? 'var(--accent-green)' : (this.sessionProfit < 0 ? 'var(--accent-pink)' : '#fff');
            }
            if (payload.researchPoints !== undefined) this.clientGame.state.researchPoints = payload.researchPoints;
            if (payload.starRating !== undefined) this.clientGame.state.starRating = payload.starRating;
            if (payload.chips !== undefined) this.clientGame.chips = payload.chips;
            this.updateBalance();
          }
        }, 150);
      }
    }

    updateOtherPlayers(state) {
      if (!state || !state.players) return;
      const tableId = this.activeTableId;
      const gameType = this.activeGameType;
      if (!tableId || !gameType) return;

      const otherPlayers = [];
      for (const [pId, p] of Object.entries(state.players)) {
        if (pId !== this.clientGame.playerId && p.interactingObjectId === tableId) {
          // Merge hand info from this.otherPlayersHands if present
          const handData = this.otherPlayersHands.get(pId) || {};
          otherPlayers.push({
            playerId: pId,
            ...handData
          });
        }
      }

      if (gameType === 'blackjack' || gameType === 'elec_blackjack') {
        const listEl = document.getElementById('bj-other-players-list');
        if (listEl) {
          if (otherPlayers.length > 0) {
            listEl.innerHTML = otherPlayers.map(p => {
              const shortId = p.playerId.substring(0, 5);
              let handHTML = "";
              if (p.isSplit) {
                handHTML = `
                  <div style="font-size: 9px; color: #aaa; margin-top: 2px;">Hand 1 (${this.getHandScore(p.playerHand1 || [])}) | Hand 2 (${this.getHandScore(p.playerHand2 || [])})</div>
                `;
              } else if (p.playerHand) {
                const score = this.getHandScore(p.playerHand);
                handHTML = `
                  <div style="font-size: 9px; color: #aaa; margin-top: 2px;">Hand (${score})</div>
                `;
              } else {
                handHTML = `
                  <div style="font-size: 9px; color: #aaa; margin-top: 2px;">Joined (Waiting for deal)</div>
                `;
              }
              const pState = p.state || 'betting';
              return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 6px; border-radius: 6px; text-align: left;">
                  <div style="color: var(--accent-blue); font-weight: bold;">Manager ${shortId}</div>
                  ${handHTML}
                  <div style="font-size: 8px; color: ${pState === 'resolved' ? '#ff4d4d' : '#39ff14'}; text-transform: uppercase; margin-top: 2px;">${pState}</div>
                </div>
              `;
            }).join('');
          } else {
            listEl.innerHTML = `<div style="padding: 12px 0; font-size:10px;">No other players playing at this table</div>`;
          }
        }
      } else if (gameType === 'craps' || gameType === 'bubble_craps') {
        const inlineContainer = document.getElementById('craps-other-players-inline');
        const inlineList = document.getElementById('craps-other-players-list-inline');
        if (inlineContainer && inlineList) {
          if (otherPlayers.length > 0) {
            inlineContainer.style.display = 'flex';
            inlineList.innerText = otherPlayers.map(p => `Manager ${p.playerId.substring(0, 5)}`).join(', ');
          } else {
            inlineContainer.style.display = 'none';
          }
        }
      } else if (gameType === 'ride_the_bus') {
        const listEl = document.getElementById('rtb-other-players-list');
        if (listEl) {
          if (otherPlayers.length > 0) {
            listEl.innerHTML = otherPlayers.map(p => {
              const shortId = p.playerId.substring(0, 5);
              let stepHTML = "";
              if (p.step) {
                stepHTML = `
                  <div style="font-size: 9px; color: #aaa; margin-top: 2px;">Step ${p.step}</div>
                `;
              } else {
                stepHTML = `
                  <div style="font-size: 9px; color: #aaa; margin-top: 2px;">Joined (Waiting for deal)</div>
                `;
              }
              const pState = p.state || 'betting';
              return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 6px; border-radius: 6px; text-align: left;">
                  <div style="color: var(--accent-blue); font-weight: bold;">Manager ${shortId}</div>
                  ${stepHTML}
                  <div style="font-size: 8px; color: ${pState === 'resolved' ? '#ff4d4d' : '#39ff14'}; text-transform: uppercase; margin-top: 2px;">${pState}</div>
                </div>
              `;
            }).join('');
          } else {
            listEl.innerHTML = `<div style="padding: 12px 0; font-size:10px;">No other players playing at this table</div>`;
          }
        }
      } else {
        const listEl = document.getElementById(`${gameType}-other-players-list`);
        if (listEl) {
          if (otherPlayers.length > 0) {
            listEl.innerHTML = otherPlayers.map(p => {
              const shortId = p.playerId.substring(0, 5);
              const pState = p.state || 'playing';
              return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 6px; border-radius: 6px; text-align: left;">
                  <div style="color: var(--accent-blue); font-weight: bold;">Manager ${shortId}</div>
                  <div style="font-size: 9px; color: #aaa; margin-top: 2px;">At table / playing</div>
                  <div style="font-size: 8px; color: #39ff14; text-transform: uppercase; margin-top: 2px;">${pState}</div>
                </div>
              `;
            }).join('');
          } else {
            listEl.innerHTML = `<div style="padding: 12px 0; font-size:10px;">No other players playing at this table</div>`;
          }
        }
      }
    }
  }

  window.Casino.MinigameUI = MinigameUI;
  window.Casino.MinigameUI = MinigameUI; // standard expose
  // window.Casino.MinigameUI = MinigameUI;
  // window.Casino.MinigameUI = MinigameUI;
})();
