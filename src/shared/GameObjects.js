// Casino Objects Catalog defining dimensions, cost, and passive income variables
(function() {
  window.Casino.GameObjects = {
    Catalog: {
      roulette: {
        type: 'roulette',
        name: 'Roulette Table',
        width: 3,  // dimensions in grid cells
        height: 2,
        cost: 500,
        color: '#0e301d',      // Felt Green
        accentColor: '#ffd700', // Gold neon outline
        icon: '🎡',
        guestCapacity: 4,      // Max guests that can gamble concurrently
        tickIncome: 3,
        useTime: 3000          // Time guest spends at table (ms)
      },
      craps: {
        type: 'craps',
        name: 'Craps Table',
        width: 4,
        height: 2,
        cost: 800,
        color: '#0f5132',      // Dark Felt
        accentColor: '#ff007f', // Pink neon outline
        icon: '🎲',
        guestCapacity: 6,
        tickIncome: 3,
        useTime: 4000
      },
      slots: {
        type: 'slots',
        name: 'Slot Machine',
        width: 1,
        height: 1,
        cost: 200,
        color: '#222222',      // Dark arcade frame
        accentColor: '#7928ca', // Purple neon outline
        icon: '🎰',
        guestCapacity: 1,
        tickIncome: 1,
        useTime: 1500
      },
      bar: {
        type: 'bar',
        name: 'Cocktail Bar',
        width: 2,
        height: 2,
        cost: 300,
        color: '#1a1a2e',      // Cyber Blue
        accentColor: '#00f0ff', // Cyan outline
        icon: '🍺',
        guestCapacity: 3,
        tickIncome: 3,
        useTime: 2000
      },
      restaurant: {
      researchCost: 10,
      requiredRating: 3.0,
        type: 'restaurant',
        name: 'Restaurant Square',
        width: 3,
        height: 3,
        cost: 1000,
        color: '#3a221d',      // Warm wood
        accentColor: '#ffaa00', // Orange-yellow neon glow
        icon: '🍔',
        guestCapacity: 8,
        tickIncome: 6,
        useTime: 3500
      },
      bathroom: {
      researchCost: 5,
      requiredRating: 2.0,
        type: 'bathroom',
        name: 'Luxury Bathroom',
        width: 2,
        height: 2,
        cost: 400,
        color: '#1c2434',      // Sleek Navy
        accentColor: '#39ff14', // Neon Green outline
        icon: '🚻',
        guestCapacity: 3,
        tickIncome: 2,
        useTime: 2500
      },
      soda_machine: {
        type: 'soda_machine',
        name: 'Shoddy Soda Machine',
        width: 1,
        height: 1,
        cost: 100,
        color: '#b22222',      // Firebrick Red
        accentColor: '#ffaa00', // Amber orange glow
        icon: '🥤',
        guestCapacity: 1,
        tickIncome: 1,
        useTime: 800
      },
      vending_machine: {
        type: 'vending_machine',
        name: 'Shoddy Vending Machine',
        width: 1,
        height: 1,
        cost: 120,
        color: '#3e2723',      // Dark brown
        accentColor: '#ffd700', // Gold outline
        icon: '🍫',
        guestCapacity: 1,
        tickIncome: 2,
        useTime: 800
      },
      bathroom_stall: {
        type: 'bathroom_stall',
        name: 'Shoddy Bathroom Stall',
        width: 1,
        height: 1,
        cost: 150,
        color: '#37474f',      // Blue Grey
        accentColor: '#00e676', // Bright green
        icon: '🚽',
        guestCapacity: 1,
        tickIncome: 1,
        useTime: 1500
      },
      jazz_band: {
      researchCost: 6,
      requiredRating: 2.0,
        type: 'jazz_band',
        name: 'Jazz Band Stage',
        width: 2,
        height: 2,
        cost: 500,
        color: '#3b0066',      // Deep purple
        accentColor: '#e64dff', // Neon magenta glow
        icon: '🎺',
        guestCapacity: 3,
        tickIncome: 15,        // Cover charge!
        useTime: 3000
      },
      minigame_machine: {
        researchCost: 50,
        requiredRating: 1.0,
        type: 'minigame_machine',
        name: 'Retro Arcade Cabinet',
        width: 1,
        height: 1,
        cost: 350,
        color: '#1a1a3a',      // Dark arcade casing
        accentColor: '#39ff14', // Neon green screen glow
        icon: '🕹️',
        guestCapacity: 1,
        tickIncome: 2,
        useTime: 2000
      },
      blackjack: {
        researchCost: 15,
        requiredRating: 1.8,
        type: 'blackjack',
        name: 'Blackjack Table',
        width: 2,
        height: 2,
        cost: 600,
        color: '#0e6030',      // Deep green felt
        accentColor: '#ffd700', // Gold outline
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 4,
        useTime: 2500
      },
      ride_the_bus: {
        researchCost: 10,
        requiredRating: 1.5,
        type: 'ride_the_bus',
        name: 'Ride The Bus Table',
        width: 2,
        height: 2,
        cost: 400,
        color: '#600e12',      // Deep red felt
        accentColor: '#ffaa00', // Amber orange
        icon: '🚌',
        guestCapacity: 3,
        tickIncome: 2,
        useTime: 2000
      },
      three_card_poker: {
        researchCost: 18,
        requiredRating: 2.2,
        type: 'three_card_poker',
        name: '3 Card Poker Table',
        width: 2,
        height: 2,
        cost: 700,
        color: '#0f2042',      // Deep blue felt
        accentColor: '#00f0ff', // Cyber cyan
        icon: '👑',
        guestCapacity: 3,
        tickIncome: 4,
        useTime: 2500
      },
      elec_roulette: {
      researchCost: 8,
      requiredRating: 2.5,
        type: 'elec_roulette',
        name: 'Electronic Roulette Kiosk',
        width: 1,
        height: 1,
        cost: 350,
        color: '#1a1a2e',      // Futuristic slate
        accentColor: '#ff007f', // Cyber pink
        icon: '🎡',
        guestCapacity: 1,
        tickIncome: 6,
        useTime: 1500
      },
      elec_blackjack: {
      researchCost: 8,
      requiredRating: 2.5,
        type: 'elec_blackjack',
        name: 'Electronic Blackjack Kiosk',
        width: 1,
        height: 1,
        cost: 380,
        color: '#1a1a2e',
        accentColor: '#00f0ff', // Cyber cyan
        icon: '🃏',
        guestCapacity: 1,
        tickIncome: 7,
        useTime: 1800
      },
      bubble_craps: {
      researchCost: 5,
      requiredRating: 2.0,
        type: 'bubble_craps',
        name: 'Bubble Craps Station',
        width: 1,
        height: 1,
        cost: 450,
        color: '#1a1a2e',
        accentColor: '#39ff14', // Cyber green
        icon: '🎲',
        guestCapacity: 1,
        tickIncome: 8,
        useTime: 1800
      },
      atm: {
      researchCost: 5,
      requiredRating: 2.0,
        type: 'atm',
        name: 'ATM Cash Machine',
        width: 1,
        height: 1,
        cost: 500,
        color: '#0e2b60',      // Blue casing
        accentColor: '#39ff14', // Green slot
        icon: '🏧',
        guestCapacity: 1,
        tickIncome: 0,         // ATM collects withdrawal fee from budget, not ticket income
        useTime: 2000
      },
      baccarat: {
      researchCost: 8,
      requiredRating: 2.5,
        type: 'baccarat',
        name: 'Baccarat Table',
        width: 2,
        height: 2,
        cost: 900,
        color: '#0e4a28',
        accentColor: '#ffd700',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 10,
        useTime: 2200
      },
      texas_holdem: {
      researchCost: 10,
      requiredRating: 2.5,
        type: 'texas_holdem',
        name: 'Texas Holdem Bonus',
        width: 2,
        height: 2,
        cost: 1100,
        color: '#123f75',
        accentColor: '#ffaa00',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 12,
        useTime: 3000
      },
      pai_gow: {
      researchCost: 10,
      requiredRating: 3.0,
        type: 'pai_gow',
        name: 'Pai Gow Poker Table',
        width: 2,
        height: 2,
        cost: 1300,
        color: '#7a1f29',
        accentColor: '#ffd700',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 14,
        useTime: 3500
      },
      sic_bo: {
      researchCost: 10,
      requiredRating: 3.0,
        type: 'sic_bo',
        name: 'Sic Bo Table',
        width: 3,
        height: 2,
        cost: 1500,
        color: '#1a1f38',
        accentColor: '#39ff14',
        icon: '🎲',
        guestCapacity: 4,
        tickIncome: 15,
        useTime: 3000
      },
      caribbean_stud: {
      researchCost: 12,
      requiredRating: 3.5,
        type: 'caribbean_stud',
        name: 'Caribbean Stud Table',
        width: 2,
        height: 2,
        cost: 1800,
        color: '#0e5560',
        accentColor: '#ffd700',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 18,
        useTime: 2800
      },
      big_six: {
      researchCost: 12,
      requiredRating: 3.5,
        type: 'big_six',
        name: 'Big Six Wheel Table',
        width: 2,
        height: 1,
        cost: 2000,
        color: '#4a0e60',
        accentColor: '#e64dff',
        icon: '🎡',
        guestCapacity: 2,
        tickIncome: 20,
        useTime: 2400
      },
      let_it_ride: {
      researchCost: 15,
      requiredRating: 4.0,
        type: 'let_it_ride',
        name: 'Let It Ride Table',
        width: 2,
        height: 2,
        cost: 2200,
        color: '#0a3028',
        accentColor: '#00f0ff',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 22,
        useTime: 2600
      },
      red_dog: {
      researchCost: 15,
      requiredRating: 4.0,
        type: 'red_dog',
        name: 'Red Dog Table',
        width: 2,
        height: 2,
        cost: 2500,
        color: '#600a0e',
        accentColor: '#ffaa00',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 25,
        useTime: 2200
      },
      spanish_21: {
      researchCost: 15,
      requiredRating: 4.5,
        type: 'spanish_21',
        name: 'Spanish 21 Table',
        width: 2,
        height: 2,
        cost: 2800,
        color: '#0e4a30',
        accentColor: '#ffd700',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 28,
        useTime: 2500
      },
      casino_war: {
      researchCost: 15,
      requiredRating: 4.5,
        type: 'casino_war',
        name: 'Casino War Table',
        width: 2,
        height: 2,
        cost: 3200,
        color: '#400e12',
        accentColor: '#ff007f',
        icon: '🃏',
        guestCapacity: 3,
        tickIncome: 32,
        useTime: 1800
      },
      video_poker: {
      researchCost: 5,
      requiredRating: 2.0,
        type: 'video_poker',
        name: 'Video Poker Console',
        width: 1,
        height: 1,
        cost: 400,
        color: '#111122',
        accentColor: '#e64dff',
        icon: '🕹️',
        guestCapacity: 1,
        tickIncome: 8,
        useTime: 1800
      },
      elec_sic_bo: {
      researchCost: 10,
      requiredRating: 3.0,
      researchCost: 10,
      requiredRating: 3.0,
        type: 'elec_sic_bo',
        name: 'Electronic Sic Bo Console',
        width: 1,
        height: 1,
        cost: 500,
        color: '#1a1a2e',
        accentColor: '#39ff14',
        icon: '🕹️',
        guestCapacity: 1,
        tickIncome: 9,
        useTime: 1800
      },
      elec_baccarat: {
      researchCost: 10,
      requiredRating: 3.0,
      researchCost: 8,
      requiredRating: 2.5,
        type: 'elec_baccarat',
        name: 'Electronic Baccarat Terminal',
        width: 1,
        height: 1,
        cost: 600,
        color: '#1a1a2e',
        accentColor: '#ffd700',
        icon: '🕹️',
        guestCapacity: 1,
        tickIncome: 10,
        useTime: 2000
      },
      plinko: {
      researchCost: 10,
      requiredRating: 3.0,
        type: 'plinko',
        name: 'Plinko Peggy Machine',
        width: 1,
        height: 1,
        cost: 800,
        color: '#1c1c1e',
        accentColor: '#ffaa00',
        icon: '🕹️',
        guestCapacity: 1,
        tickIncome: 12,
        useTime: 2500
      },
      lottery: {
      researchCost: 12,
      requiredRating: 3.5,
        type: 'lottery',
        name: 'Kiosk Lottery Console',
        width: 1,
        height: 1,
        cost: 1000,
        color: '#1c1c1e',
        accentColor: '#00f0ff',
        icon: '🕹️',
        guestCapacity: 1,
        tickIncome: 15,
        useTime: 2000
      },
      // Upgrades & Amenities
      palm_tree: {
      researchCost: 4,
      requiredRating: 1.5,
        type: 'palm_tree',
        name: 'Neon Palm Tree',
        width: 1,
        height: 1,
        cost: 200,
        color: '#08331d',
        accentColor: '#39ff14',
        icon: '🌴',
        guestCapacity: 0,
        tickIncome: 0,
        useTime: 0
      },
      fountain: {
      researchCost: 8,
      requiredRating: 2.5,
        type: 'fountain',
        name: 'Cyber Fountain',
        width: 2,
        height: 2,
        cost: 800,
        color: '#0f243a',
        accentColor: '#00f0ff',
        icon: '⛲',
        guestCapacity: 0,
        tickIncome: 0,
        useTime: 0
      },
      glow_sofa: {
      researchCost: 5,
      requiredRating: 2.0,
        type: 'glow_sofa',
        name: 'Glow Sofa Lounge',
        width: 2,
        height: 1,
        cost: 400,
        color: '#2a083a',
        accentColor: '#e64dff',
        icon: '🛋️',
        guestCapacity: 2,
        tickIncome: 0,
        useTime: 3000
      },
      arcade_console: {
      researchCost: 5,
      requiredRating: 2.0,
        type: 'arcade_console',
        name: 'Retro Arcade Console',
        width: 1,
        height: 1,
        cost: 300,
        color: '#1a102e',
        accentColor: '#ff007f',
        icon: '👾',
        guestCapacity: 1,
        tickIncome: 5,
        useTime: 2000
      },
      candy_dispenser: {
        type: 'candy_dispenser',
        name: 'Candy Dispenser',
        width: 1,
        height: 1,
        cost: 100,
        color: '#4e102e',
        accentColor: '#ffaa00',
        icon: '🍬',
        guestCapacity: 1,
        tickIncome: 5,
        useTime: 800
      },
      coffee_maker: {
        type: 'coffee_maker',
        name: 'Coffee Maker Bar',
        width: 1,
        height: 1,
        cost: 250,
        color: '#2e1c10',
        accentColor: '#ffd700',
        icon: '☕',
        guestCapacity: 1,
        tickIncome: 12,
        useTime: 1000
      },
      popcorn_cart: {
        type: 'popcorn_cart',
        name: 'Popcorn Cart',
        width: 1,
        height: 1,
        cost: 150,
        color: '#4a4410',
        accentColor: '#ffaa00',
        icon: '🍿',
        guestCapacity: 1,
        tickIncome: 8,
        useTime: 900
      },
      pizza_oven: {
      researchCost: 6,
      requiredRating: 2.0,
        type: 'pizza_oven',
        name: 'Gourmet Pizza Oven',
        width: 2,
        height: 1,
        cost: 600,
        color: '#4a1e10',
        accentColor: '#ffaa00',
        icon: '🍕',
        guestCapacity: 1,
        tickIncome: 4,
        useTime: 1500
      },
      ice_cream: {
      researchCost: 6,
      requiredRating: 2.0,
        type: 'ice_cream',
        name: 'Cyber Ice Cream Bar',
        width: 2,
        height: 1,
        cost: 450,
        color: '#104a3e',
        accentColor: '#e64dff',
        icon: '🍦',
        guestCapacity: 2,
        tickIncome: 3,
        useTime: 1500
      },
      bubble_tea: {
      researchCost: 8,
      requiredRating: 2.5,
        type: 'bubble_tea',
        name: 'Bubble Tea Kiosk',
        width: 2,
        height: 2,
        cost: 700,
        color: '#4a3e10',
        accentColor: '#ffd700',
        icon: '🧋',
        guestCapacity: 2,
        tickIncome: 4,
        useTime: 2000
      },
      gold_statue: {
      researchCost: 10,
      requiredRating: 3.0,
        type: 'gold_statue',
        name: 'Gold Statue',
        width: 1,
        height: 1,
        cost: 1200,
        color: '#63530e',
        accentColor: '#ffd700',
        icon: '🗽',
        guestCapacity: 0,
        tickIncome: 0,
        useTime: 0
      },
      vr_pod: {
      researchCost: 12,
      requiredRating: 3.5,
        type: 'vr_pod',
        name: 'Virtual Reality Pod',
        width: 2,
        height: 2,
        cost: 1500,
        color: '#0e2060',
        accentColor: '#00f0ff',
        icon: '🕶️',
        guestCapacity: 1,
        tickIncome: 15,
        useTime: 3500
      },
      vip_lounge: {
      researchCost: 15,
      requiredRating: 4.0,
        type: 'vip_lounge',
        name: 'VIP Champagne Lounge',
        width: 3,
        height: 3,
        cost: 2500,
        color: '#100e60',
        accentColor: '#ffd700',
        icon: '🥂',
        guestCapacity: 6,
        tickIncome: 25,
        useTime: 4000
      },
      hologram: {
      researchCost: 12,
      requiredRating: 3.5,
        type: 'hologram',
        name: 'Neon Hologram Projector',
        width: 1,
        height: 1,
        cost: 900,
        color: '#0e5f60',
        accentColor: '#00f0ff',
        icon: '🔮',
        guestCapacity: 0,
        tickIncome: 10,
        useTime: 0
      },
      massage_chair: {
      researchCost: 8,
      requiredRating: 2.5,
        type: 'massage_chair',
        name: 'Massage Chair',
        width: 1,
        height: 1,
        cost: 600,
        color: '#2b2c2e',
        accentColor: '#39ff14',
        icon: '💺',
        guestCapacity: 1,
        tickIncome: 8,
        useTime: 2500
      },
      chef: {
        type: 'chef',
        name: 'Food Chef Specialist',
        cost: 0,
        researchCost: 80,
        requiredRating: 2.0
      },
      scientist: {
        type: 'scientist',
        name: 'Research Scientist',
        cost: 0,
        researchCost: 120,
        requiredRating: 3.0
      },
      manager: {
        type: 'manager',
        name: 'Casino Manager',
        cost: 0,
        researchCost: 150,
        requiredRating: 3.5
      },
      security: {
        type: 'security',
        name: 'Security Guard',
        cost: 0,
        researchCost: 80,
        requiredRating: 2.0
      },
      tech_support: {
        type: 'tech_support',
        name: 'Tech Support Specialist',
        cost: 0,
        researchCost: 100,
        requiredRating: 2.5
      },
      entertainer: {
        type: 'entertainer',
        name: 'Stage Entertainer',
        cost: 0,
        researchCost: 120,
        requiredRating: 3.0
      },
      stocker: {
        type: 'stocker',
        name: 'Amenity Stocker',
        cost: 0,
        researchCost: 60,
        requiredRating: 1.5
      },
      janitor: {
        type: 'janitor',
        name: 'Janitor Cleaner',
        cost: 0,
        researchCost: 40,
        requiredRating: 1.0
      },
    },

    // Factory method to instantiate a placed object
    createPlaced(id, type, gridX, gridY) {
      const template = this.Catalog[type];
      if (!template) return null;

      // Generate adjacent coordinates as seat candidate offsets
      const seats = [];
      const candidates = [];
      const w = template.width;
      const h = template.height;

      // Bottom perimeter cells
      for (let x = 0; x < w; x++) candidates.push({ rx: x, ry: h });
      // Right perimeter cells
      for (let y = 0; y < h; y++) candidates.push({ rx: w, ry: y });
      // Top perimeter cells (except dealer seats)
      for (let x = 0; x < w; x++) {
        if (['roulette', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(type) && x === 1) continue;
        if (type === 'big_six' && x === 0) continue;
        if (type === 'craps' && x === 2) continue;
        candidates.push({ rx: x, ry: -1 });
      }
      // Left perimeter cells
      for (let y = 0; y < h; y++) candidates.push({ rx: -1, ry: y });

      // Generate seats up to initial guest capacity
      for (let i = 0; i < template.guestCapacity; i++) {
        const c = candidates[i % candidates.length];
        seats.push({
          rx: c.rx,
          ry: c.ry,
          guestId: null
        });
      }

      // Setup dealer seats for tables
      let dealerSeat = null;
      if (['roulette', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(type)) {
        dealerSeat = { rx: 1, ry: -1, employeeId: null };
      } else if (type === 'big_six') {
        dealerSeat = { rx: 0, ry: -1, employeeId: null };
      } else if (type === 'craps') {
        dealerSeat = { rx: 2, ry: -1, employeeId: null };
      }

      // Setup stock properties for food/drink amenities
      let maxStock = null;
      let stock = null;
      if (['bar', 'restaurant', 'soda_machine', 'vending_machine', 'candy_dispenser', 'coffee_maker', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'bubble_tea'].includes(type)) {
        if (type === 'bar') maxStock = 15;
        else if (type === 'restaurant') maxStock = 25;
        else if (['pizza_oven', 'ice_cream', 'bubble_tea'].includes(type)) maxStock = 10;
        else maxStock = 5;
        stock = maxStock;
      }

      return {
        id: id,
        type: type,
        name: template.name,
        gridX: gridX,
        gridY: gridY,
        width: w,
        height: h,
        color: template.color,
        accentColor: template.accentColor,
        icon: template.icon,
        guestCapacity: template.guestCapacity,
        tickIncome: template.tickIncome,
        useTime: template.useTime,
        guests: [], // List of guestIds currently occupying this object
        seats: seats, // Occupying seats list
        upgradesCount: { capacity: 0, income: 0 }, // Purchase trackers
        dealerSeat: dealerSeat, // Dealer seat state
        maxStock: maxStock,
        stock: stock,
        isOutOfStock: stock !== null ? (stock === 0) : false
      };
    }
  };
})();
