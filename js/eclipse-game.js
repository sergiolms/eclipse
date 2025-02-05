class EclipseGame extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.gridSize = 6;
    this.cells = [];
    this.solution = [];
    this.clues = [];
    this.validationTimeout = null;
  }

  connectedCallback() {
    this.render();
    this.setupGame();
    this.generateSolution();
    this.generateFixedCellsFromSolution();
    this.generateCluesFromSolution();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="css/eclipse-styles.css">
      <div class="grid">
        ${Array.from({ length: this.gridSize * this.gridSize })
          .map((_, index) => `
            <div class="cell" data-index="${index}">
              <div class="cell-content"></div>
            </div>
          `).join('')}
      </div>
      <button class="show-solution">Mostrar Solución</button>
      <div class="solution-grid hidden"></div>
    `;

    // Añadir evento al botón
    this.shadowRoot.querySelector('.show-solution').addEventListener('click', () => {
      this.toggleSolution();
    });
  }

  setupGame() {
    this.cells = Array.from(this.shadowRoot.querySelectorAll('.cell'));
    this.cells.forEach((cell, index) => {
      cell.x = index % this.gridSize;
      cell.y = Math.floor(index / this.gridSize);
      cell.addEventListener('click', () => this.clickCell(cell));
    });
  }

  clickCell(cell) {
    if (cell.classList.contains('fixed')) return;
    
    const currentType = cell.getAttribute('data-type');
    let newType;
    
    // Rotar entre sol, luna y vacío
    switch (currentType) {
        case 'sun':
            newType = 'moon';
            break;
        case 'moon':
            newType = null; // Vacío
            break;
        default:
            newType = 'sun';
            break;
    }
    
    // Actualizar la celda
    if (newType) {
        cell.setAttribute('data-type', newType);
        cell.querySelector('.cell-content').textContent = newType === 'sun' ? '🌞' : '🌚';
    } else {
        cell.removeAttribute('data-type');
        cell.querySelector('.cell-content').textContent = '';
    }
    
    // Debounce para la validación
    if (this.validationTimeout) {
        clearTimeout(this.validationTimeout);
    }
    
    this.validationTimeout = setTimeout(() => {
        const x = cell.x;
        const y = cell.y;
        
        // Validar solo la celda pulsada y sus adyacentes
        this.validateCellAndNeighbors(cell);
        
        this.checkRules();
    }, 500); // 500ms de debounce
  }

  validateCellAndNeighbors(cell) {
    const x = cell.x;
    const y = cell.y;
    
    // Validar la celda pulsada
    const rowValid = this.validateUserRow(y);
    const colValid = this.validateUserCol(x);
    const cluesValid = this.validateClues(cell);
    
    if (!rowValid || !colValid || !cluesValid) {
        this.highlightInvalidCells(y, x);
    } else {
        // Limpiar solo los errores relacionados con esta celda y sus adyacentes
        this.clearCellAndNeighborHighlights(cell);
    }
  }

  validateUserRow(y) {
    const rowCells = this.getRowCells(y);
    return this.validateUserSequence(rowCells);
  }

  validateUserCol(x) {
    const colCells = this.getColCells(x);
    return this.validateUserSequence(colCells);
  }

  validateUserSequence(cells) {
    // Verificar que no haya tres o más iguales seguidos, ignorando celdas vacías
    let count = 1;
    let prevType = null;
    
    for (let i = 0; i < cells.length; i++) {
        const currentType = cells[i].getAttribute('data-type');
        
        if (!currentType) {
            count = 1; // Reiniciar el contador si la celda está vacía
            prevType = null;
            continue;
        }

        if (prevType && prevType === currentType) {
            count++;
            if (count >= 3) return false; // Tres o más iguales consecutivos
        } else {
            count = 1; // Reiniciar el contador si cambia el tipo
        }
        prevType = currentType;
    }
    
    // Verificar balance de símbolos solo en celdas llenas
    const filledCells = cells.filter(cell => cell.getAttribute('data-type'));
    const sunCount = filledCells.filter(c => c.getAttribute('data-type') === 'sun').length;
    const moonCount = filledCells.filter(c => c.getAttribute('data-type') === 'moon').length;
    
    // Si hay celdas vacías, verificar que el desbalance no sea mayor que las celdas vacías
    const emptyCount = cells.length - filledCells.length;
    if (emptyCount > 0) {
        return Math.abs(sunCount - moonCount) <= emptyCount;
    }
    
    // Si no hay celdas vacías, deben ser iguales
    return sunCount === moonCount;
  }

  validateClues(cell) {
    const directions = [
        { x: -1, y: 0 },  // Izquierda
        { x: 1, y: 0 },   // Derecha
        { x: 0, y: -1 },  // Arriba
        { x: 0, y: 1 }    // Abajo
    ];

    for (const dir of directions) {
        const neighbor = this.getCell(cell.x + dir.x, cell.y + dir.y);
        if (neighbor) {
            const clue = this.clues.find(c => 
                (c.cell1 === cell && c.cell2 === neighbor) ||
                (c.cell1 === neighbor && c.cell2 === cell)
            );

            if (clue) {
                const type1 = cell.getAttribute('data-type');
                const type2 = neighbor.getAttribute('data-type');
                
                // Solo validar si ambas celdas tienen contenido
                if (type1 && type2) {
                    if (clue.type === '=' && type1 !== type2) return false;
                    if (clue.type === 'x' && type1 === type2) return false;
                }
            }
        }
    }
    return true;
  }

  highlightInvalidCells(y, x) {
    const cell = this.getCell(x, y);
    
    // Reiniciar estilos de la fila, columna y adyacentes
    this.resetCellAndNeighborHighlights(cell);
    
    // Verificar si el error es en la fila
    if (!this.validateUserRow(y)) {
        this.getRowCells(y).forEach(cell => {
            cell.classList.add('invalid');
        });
    }
    
    // Verificar si el error es en la columna
    if (!this.validateUserCol(x)) {
        this.getColCells(x).forEach(cell => {
            cell.classList.add('invalid');
        });
    }
    
    // Verificar si el error es en una pista
    if (!this.validateClues(cell)) {
        const directions = [
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: 0, y: -1 }, { x: 0, y: 1 }
        ];
        
        directions.forEach(dir => {
            const neighbor = this.getCell(x + dir.x, y + dir.y);
            if (neighbor) {
                const clue = this.clues.find(c => 
                    (c.cell1 === cell && c.cell2 === neighbor) ||
                    (c.cell1 === neighbor && c.cell2 === cell)
                );
                
                if (clue) {
                    const type1 = cell.getAttribute('data-type');
                    const type2 = neighbor.getAttribute('data-type');
                    
                    if ((clue.type === '=' && type1 !== type2) || 
                        (clue.type === 'x' && type1 === type2)) {
                        // Solo resaltar las celdas involucradas en la pista
                        cell.classList.add('invalid');
                        neighbor.classList.add('invalid');
                    }
                }
            }
        });
    }
  }

  clearHighlights() {
    this.cells.forEach(cell => {
      cell.classList.remove('invalid');
    });
  }

  getRowCells(y) {
    return this.cells.filter((_, index) => Math.floor(index / this.gridSize) === y);
  }

  getColCells(x) {
    return this.cells.filter((_, index) => index % this.gridSize === x);
  }

  generateSolution() {
    // Generar una solución válida
    let validSolution = false;
    while (!validSolution) {
      this.solution = Array(this.gridSize * this.gridSize).fill(null);
      validSolution = this.fillSolution(0);
    }
  }

  fillSolution(index) {
    if (index >= this.solution.length) return true;

    const x = index % this.gridSize;
    const y = Math.floor(index / this.gridSize);

    // Probar ambos tipos en orden aleatorio
    const types = Math.random() < 0.5 ? ['sun', 'moon'] : ['moon', 'sun'];

    for (const type of types) {
      this.solution[index] = type;

      if (this.validateSolutionCell(x, y) && this.fillSolution(index + 1)) {
        return true;
      }
    }

    this.solution[index] = null;
    return false;
  }

  validateSolutionCell(x, y) {
    // Verificar fila
    const row = this.getSolutionRow(y);
    if (!this.validateSolutionSequence(row)) return false;
    
    // Verificar columna
    const col = this.getSolutionCol(x);
    if (!this.validateSolutionSequence(col)) return false;
    
    // Verificar balance de símbolos
    if (!this.validateSolutionBalance(row) || !this.validateSolutionBalance(col)) {
      return false;
    }
    
    return true;
  }

  validateSolutionSequence(cells) {
    // Verificar que no haya más de dos iguales seguidos
    let count = 1;
    for (let i = 1; i < cells.length; i++) {
      if (cells[i - 1] && cells[i] && cells[i - 1] === cells[i]) {
        count++;
        if (count > 2) return false;
      } else {
        count = 1;
      }
    }
    return true;
  }

  validateSolutionBalance(cells) {
    // Verificar que haya el mismo número de soles y lunas
    const sunCount = cells.filter(c => c === 'sun').length;
    const moonCount = cells.filter(c => c === 'moon').length;
    
    // Si la fila/columna está completa, debe tener igual número de soles y lunas
    if (cells.every(c => c !== null)) {
      return sunCount === moonCount;
    }
    
    // Si no está completa, verificar que no haya un desbalance mayor a la cantidad de celdas vacías
    const emptyCount = cells.filter(c => c === null).length;
    return Math.abs(sunCount - moonCount) <= emptyCount;
  }

  generateCluesFromSolution() {
    this.clues = []; // Limpiar pistas anteriores
    const directions = [
      { x: 1, y: 0 },  // Derecha
      { x: 0, y: 1 }   // Abajo
    ];

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cell = this.getCell(x, y);
        for (const dir of directions) {
          const neighbor = this.getCell(x + dir.x, y + dir.y);
          if (neighbor) {
            // Verificar si ambas celdas son fijas
            if (cell.classList.contains('fixed') && neighbor.classList.contains('fixed')) {
              continue; // Saltar si ambas son fijas
            }
            
            const type1 = this.solution[y * this.gridSize + x];
            const type2 = this.solution[(y + dir.y) * this.gridSize + (x + dir.x)];
            
            // Generar pista basada en la solución
            const clueType = type1 === type2 ? '=' : 'x';
            if (Math.random() < 0.2) { // 20% de probabilidad de pista
              this.displayClue(cell, neighbor, clueType);
              // Almacenar la pista
              this.clues.push({
                cell1: cell,
                cell2: neighbor,
                type: clueType
              });
            }
          }
        }
      }
    }
  }

  generateFixedCellsFromSolution() {
    const fixedCount = Math.floor(this.gridSize * 1.5);
    const indices = Array.from({ length: this.gridSize * this.gridSize }, (_, i) => i);
    
    // Mezclar índices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Seleccionar las primeras fixedCount celdas como fijas
    for (let i = 0; i < fixedCount; i++) {
      const cell = this.cells[indices[i]];
      const type = this.solution[indices[i]];
      cell.setAttribute('data-type', type);
      cell.querySelector('.cell-content').textContent = type === 'sun' ? '🌞' : '🌚';
      cell.classList.add('fixed');
    }
  }

  checkRules() {
    // Verificar si todas las celdas están llenas
    const allCellsFilled = this.cells.every(cell => cell.getAttribute('data-type'));
    
    if (!allCellsFilled) return;

    // Verificar filas y columnas
    let valid = true;
    for (let i = 0; i < this.gridSize; i++) {
        const rowCells = this.getRowCells(i);
        const colCells = this.getColCells(i);
        
        if (!this.validateUserSequence(rowCells) || !this.validateUserSequence(colCells)) {
            valid = false;
            break;
        }
    }

    // Verificar todas las pistas
    if (valid) {
        for (const clue of this.clues) {
            const type1 = clue.cell1.getAttribute('data-type');
            const type2 = clue.cell2.getAttribute('data-type');
            
            if (!type1 || !type2) continue;

            if (clue.type === '=' && type1 !== type2) {
                valid = false;
                break;
            }
            if (clue.type === 'x' && type1 === type2) {
                valid = false;
                break;
            }
        }
    }

    // Si todo es válido, manejar la victoria
    if (valid) {
        setTimeout(() => {
            this.handleWin();
        }, 100);
    }

    // Limpiar estados inválidos solo en las celdas que ya no violan las reglas
    this.cells.filter(cell => cell.classList.contains('invalid')).forEach(cell => {
        const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
        const row = Math.floor(cellIndex / this.gridSize);
        const col = cellIndex % this.gridSize;
        
        // Verificar si la celda ya no viola las reglas
        if (!this.isInvalidCell(row, col)) {
            cell.classList.remove('invalid');
        }
    });
  }

  handleWin() {
    // Bloquear el panel de juego
    this.cells.forEach(cell => {
      cell.style.pointerEvents = 'none';
    });

    // Mostrar mensaje de enhorabuena
    const winMessage = document.createElement('div');
    winMessage.className = 'win-message';
    winMessage.innerHTML = `
      <h2>¡Enhorabuena!</h2>
      <p>Has completado el puzzle correctamente</p>
    `;
    this.shadowRoot.appendChild(winMessage);

    // Lanzar confeti
    this.launchConfetti();
  }

  launchConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    this.shadowRoot.appendChild(confettiContainer);

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const confettiCount = 200;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.animationDelay = `${Math.random() * 2}s`;
      confettiContainer.appendChild(confetti);
    }

    // Eliminar confeti después de la animación
    setTimeout(() => {
      confettiContainer.remove();
    }, 6000);
  }

  getFixedCells() {
    return this.cells.filter(cell => cell.classList.contains('fixed'));
  }

  displayClue(cell1, cell2, clueType) {
    const x1 = cell1.x, y1 = cell1.y;
    const x2 = cell2.x, y2 = cell2.y;
    
    const clueElement = document.createElement('div');
    clueElement.className = `clue clue-${clueType}`;
    clueElement.textContent = clueType === '=' ? '=' : 'x';
    
    if (x1 === x2) { // Vertical
      clueElement.style.position = 'absolute';
      clueElement.style.left = `${x1 * 60 + 28}px`;
      clueElement.style.top = `${Math.min(y1, y2) * 60 + 60}px`;
    } else { // Horizontal
      clueElement.style.position = 'absolute';
      clueElement.style.left = `${Math.min(x1, x2) * 60 + 60}px`;
      clueElement.style.top = `${y1 * 60 + 28}px`;
    }
    
    this.shadowRoot.querySelector('.grid').appendChild(clueElement);
  }

  getCell(x, y) {
    if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
      return this.cells[y * this.gridSize + x];
    }
    return null;
  }

  getSolutionRow(y) {
    return this.solution.slice(y * this.gridSize, (y + 1) * this.gridSize);
  }

  getSolutionCol(x) {
    return this.solution.filter((_, i) => i % this.gridSize === x);
  }

  toggleSolution() {
    const solutionGrid = this.shadowRoot.querySelector('.solution-grid');
    const solutionButton = this.shadowRoot.querySelector('.show-solution');
    solutionGrid.classList.toggle('hidden');
    solutionButton.textContent = solutionGrid.classList.contains('hidden') ? 'Mostrar Solución' : 'Ocultar Solución';

    if (!solutionGrid.innerHTML) {
      // Generar la solución si no está visible
      solutionGrid.innerHTML = `
       <div class="grid">
          ${this.solution.map((type, index) => `
            <div class="cell" data-index="${index}">
              <div class="cell-content">${type === 'sun' ? '🌞' : '🌚'}</div>
            </div>
          `).join('')}
        </div>
      `;
      
    }
  }

  isInvalidCell(row, col) {
    // Mantén la lógica existente para verificar si una celda es inválida
    // ... existing code ...
    return false; // Placeholder return, actual implementation needed
  }

  validateAll() {
    // Limpiar highlights anteriores
    this.clearHighlights();
    
    let hasErrors = false;
    
    // Verificar filas
    for (let y = 0; y < this.gridSize; y++) {
        const rowCells = this.getRowCells(y);
        const filledRowCells = rowCells.filter(cell => cell.getAttribute('data-type'));
        
        if (filledRowCells.length > 0 && !this.validateUserSequence(filledRowCells)) {
            rowCells.forEach(cell => {
                if (cell.getAttribute('data-type')) {
                    cell.classList.add('invalid');
                }
            });
            hasErrors = true;
        }
    }
    
    // Verificar columnas
    for (let x = 0; x < this.gridSize; x++) {
        const colCells = this.getColCells(x);
        const filledColCells = colCells.filter(cell => cell.getAttribute('data-type'));
        
        if (filledColCells.length > 0 && !this.validateUserSequence(filledColCells)) {
            colCells.forEach(cell => {
                if (cell.getAttribute('data-type')) {
                    cell.classList.add('invalid');
                }
            });
            hasErrors = true;
        }
    }
    
    // Verificar pistas (solo si ambas celdas tienen contenido)
    for (const clue of this.clues) {
        const type1 = clue.cell1.getAttribute('data-type');
        const type2 = clue.cell2.getAttribute('data-type');
        
        if (type1 && type2) { // Solo validar si ambas celdas tienen contenido
            if ((clue.type === '=' && type1 !== type2) || 
                (clue.type === 'x' && type1 === type2)) {
                clue.cell1.classList.add('invalid');
                clue.cell2.classList.add('invalid');
                hasErrors = true;
            }
        }
    }
    
    return !hasErrors;
  }

  clearCellAndNeighborHighlights(cell) {
    const x = cell.x;
    const y = cell.y;
    
    // Limpiar highlights de la celda pulsada
    cell.classList.remove('invalid');
    
    // Limpiar highlights de toda la columna si ya no es inválida
    if (this.validateUserCol(x)) {
        this.getColCells(x).forEach(c => {
            if (!this.isCellInvalid(c)) {
                c.classList.remove('invalid');
            }
        });
    }
    
    // Limpiar highlights de toda la fila si ya no es inválida
    if (this.validateUserRow(y)) {
        this.getRowCells(y).forEach(c => {
            if (!this.isCellInvalid(c)) {
                c.classList.remove('invalid');
            }
        });
    }
    
    // Limpiar highlights de las celdas adyacentes
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];
    
    directions.forEach(dir => {
        const neighbor = this.getCell(cell.x + dir.x, cell.y + dir.y);
        if (neighbor && !this.isCellInvalid(neighbor)) {
            neighbor.classList.remove('invalid');
        }
    });
  }

  isCellInvalid(cell) {
    const x = cell.x;
    const y = cell.y;
    
    // Verificar si la celda es inválida en su fila
    if (!this.validateUserRow(y)) {
        return true;
    }
    
    // Verificar si la celda es inválida en su columna
    if (!this.validateUserCol(x)) {
        return true;
    }
    
    // Verificar si la celda es inválida en sus pistas
    if (!this.validateClues(cell)) {
        return true;
    }
    
    return false;
  }

  resetCellAndNeighborHighlights(cell) {
    const x = cell.x;
    const y = cell.y;
    
    // Limpiar highlights de la celda pulsada
    cell.classList.remove('invalid');
    
    // Limpiar highlights de toda la fila
    this.getRowCells(y).forEach(c => {
        c.classList.remove('invalid');
    });
    
    // Limpiar highlights de toda la columna
    this.getColCells(x).forEach(c => {
        c.classList.remove('invalid');
    });
    
    // Limpiar highlights de las celdas adyacentes
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];
    
    directions.forEach(dir => {
        const neighbor = this.getCell(x + dir.x, y + dir.y);
        if (neighbor) {
            neighbor.classList.remove('invalid');
        }
    });
  }
}

customElements.define('eclipse-game', EclipseGame); 