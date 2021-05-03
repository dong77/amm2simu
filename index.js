
class AMM {
	constructor(name, F, fee) {
        console.assert(F >= 1);
	    this.name = name;
        this.F = F; // amplificaiton factor
        this.totalSupply = 0.0;
        this.fee = fee;

        this.x = 0.0; // actual balances
        this.y = 0.0;
        this.vx = 0.0; // virtual balances
        this.vy = 0.0;
        this.fee = 30.0;

        this.POOL_TOKEN_BASE = 1000.0;
        this.PRICE_TOLERANCE = 0.01;
        this.debug = true;
        this.opidx = 0;
    }

    setDebug(debug) {
    	this.debug = debug;
    }

	_setVirtualBalances(vx, vy) {
        this.vx = vx;
        this.vy = vy;
    }

    _addBalances(amountX, amountY) {
        this.x += amountX;
        this.y += amountY;
    }
    _assert(condition, str) {
	  if (!condition) {
	    throw new Error(str);
	  }
	}

	toString() {
        return `\t` +
		`x : ${this.x.toFixed(4)}\n\t` +
        `y : ${this.y.toFixed(4)}\n\t` +
        `vx: ${this.vx.toFixed(4)} (${(this.vx/this.x).toFixed(4)}x)\n\t` +
        `vy: ${this.vy.toFixed(4)} (${(this.vy/this.y).toFixed(4)}x)\n\t` +
        `X : ${this.X().toFixed(4)}\n\t` +
        `Y : ${this.Y().toFixed(4)}\n\t` +
        `p : ${this.price().toFixed(4)}\n\t` +
        `s : ${this.totalSupply.toFixed(4)}`;
    }
}

class AAMM extends AMM {
	X()     { return this.vx; }
	Y()     { return this.vy; }
    K()     { return this.X() * this.Y(); }
    price() {return this.Y() / this.X(); }

    _getAmountOut(amountIn, reserveIn, reserveOut, fee) {
	    let amountInWithFee = amountIn * (10000 - fee);
	    let numerator = amountInWithFee * reserveOut;
	    let denominator = (reserveIn * 10000) + amountInWithFee;
	    let amountOut = numerator / denominator;
	    return amountOut;
	}

	join(amountX, amountY) {
        let mintAmount = 0;
        if (this.totalSupply === 0) {
            this.vx += amountX * this.F;
            this.vy += amountY * this.F;

            mintAmount = this.POOL_TOKEN_BASE;
        } else {
            this._assert(Math.abs(this.x/this.y - amountX/amountY) < this.PRICE_TOLERANCE, "ratio invalid");
            mintAmount = amountX * this.totalSupply / this.x;

            let mintAmount2 = this.totalSupply * (amountX * this.price() + amountY) / (this.x * this.price() + this.y);
            this._assert(mintAmount === mintAmount2, mintAmount +" !+ " + mintAmount2);

            const newTotalSupply = this.totalSupply + mintAmount;
            this.vx = this.vx * newTotalSupply / this.totalSupply;
            this.vy = this.vy * newTotalSupply / this.totalSupply;
        }

        this.totalSupply += mintAmount;
        this.x += amountX;
        this.y += amountY;

        if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] join ${amountX.toFixed(4)}X and ${amountY.toFixed(4)} Y`);
	        console.log(this.toString());
        }
        return mintAmount;
    }

	exit(burnAmount) {
		this._assert(burnAmount <= this.totalSupply, "insuffcient");
        const amountX = burnAmount  * this.x /  this.totalSupply;
        const amountY = burnAmount  * this.y /  this.totalSupply;

        console.log("exitX: " + amountX);
        console.log("exitY: " + amountY);

        this.x -= amountX;
        this.y -= amountY;

        const newTotalSupply = this.totalSupply - burnAmount;
        this.vx = this.vx * newTotalSupply / this.totalSupply;
        this.vy = this.vy * newTotalSupply / this.totalSupply;

        this.totalSupply = newTotalSupply;

        if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] exit -${amountX.toFixed(4)}X and -${amountY.toFixed(4)}Y`);
	        console.log(this.toString());
        }
        return [amountX, amountY];
    }

	buyY(amountIn) {
        let amountOut = this._getAmountOut(amountIn, this.vx, this.vy, this.fee);
        this.vx += amountIn;
        this.vy -= amountOut;
        this.x += amountIn;
        this.y -= amountOut;
        this._assert(this.x >= 0 && this.y >= 0, "out of bounds");

		if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] swap ${amountIn.toFixed(4)}X to ${amountOut.toFixed(4)}Y`);
	        console.log(this.toString());
        }
        return [amountIn, amountOut];
    }

    buyX(amountIn) {
        let amountOut = this._getAmountOut(amountIn, this.vy, this.vx, this.fee);
        this.vy += amountIn;
        this.vx -= amountOut;
        this.y += amountIn;
        this.x -= amountOut;
        this._assert(this.x >= 0 && this.y >= 0, "out of bounds");

		if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] swap ${amountIn.toFixed(4)}Y to ${amountOut.toFixed(4)}X`);
	        console.log(this.toString());
        }
        return [amountIn, amountOut];
    }
}

class BAMM extends AMM {

	X()     { return this.vx + this.x; }
	Y()     { return this.vy + this.y; }
    K()     { return this.X() * this.Y(); }
    price() { return this.Y() / this.X(); }

    _updateBalances(x, y) {
		this.x = x;
	    this.y = y;
	    let p = this.price();
	    // let weight = 0.2
	    // p = p* weight + this.price() * (1-weight);

	    if (x * p > y) {
	    	this.vx = x * (this.F - 1);
	    	this.vy = Math.max(0, this.X() * p - y);

		} else {
			this.vy = y * (this.F - 1);
	    	this.vx = Math.max(0, this.Y() / p - x);
	    }
   }

	join(amountX, amountY) {
        let mintAmount = 0;
        if (this.totalSupply === 0) {
			this.x = amountX;
			this.y = amountY;
            this.vx = amountX * (this.F - 1);
            this.vy = amountY * (this.F - 1);

            mintAmount = this.POOL_TOKEN_BASE;
        } else {
            this._assert(Math.abs(this.x/this.y - amountX/amountY) < this.PRICE_TOLERANCE, "ratio invalid");
            mintAmount = this.totalSupply * (amountX * this.price() + amountY) / (this.x * this.price() + this.y);
            let x = this.x + amountX;
            let y = this.y + amountY;
            this._updateBalances(x, y);
        }

        this.totalSupply += mintAmount;

        if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] join ${amountX.toFixed(4)}X and ${amountY.toFixed(4)} Y`);
	        console.log(this.toString());
        }

        return mintAmount;
    }

	exit(burnAmount) {
		this._assert(burnAmount <= this.totalSupply, "insuffcient");

        const amountX = burnAmount * this.x /  this.totalSupply;
        const amountY = burnAmount * this.y /  this.totalSupply;

        let x = this.x - amountX;
        let y = this.y - amountY;
        this._updateBalances(x, y);

        this.totalSupply = this.totalSupply - burnAmount;

        if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] exit -${amountX.toFixed(4)}X and -${amountY.toFixed(4)}Y`);
	        console.log(this.toString());
        }

        return [amountX, amountY];
    }

	buyY(amountIn) {
        let _amountOut = this.Y() - (this.K() / (this.X() + amountIn));
        if (_amountOut > this.y) {
        	_amountOut = this.y;
        }
        let _amountIn = (this.K() / (this.Y() - _amountOut)) - this.X();
        this._updateBalances(this.x + _amountIn, this.y - _amountOut);


		if (this.debug) {
			console.log(`${this.name} [${++this.opidx}] swap ${_amountIn.toFixed(4)}X to ${_amountOut.toFixed(4)}Y`);
	        console.log(this.toString());
        }
        return [_amountIn, _amountOut];
    }

	buyX(amountIn) {
        let _amountOut = this.X() - (this.K() / (this.Y() + amountIn));
        if (_amountOut > this.x) {
        	_amountOut = this.x;
        }
        let _amountIn = (this.K() / (this.X() - _amountOut)) - this.Y();

        this._updateBalances(this.x - _amountOut, this.y + _amountIn);

		if (this.debug) {

			console.log(`${this.name} [${++this.opidx}] swap ${_amountIn.toFixed(4)}Y to ${_amountOut.toFixed(4)}X`);
	        console.log(this.toString());
        }

        return [_amountIn, _amountOut];
    }
}

const fee = 50;
let pool;
pool = new AAMM('Amplified AMM', 100, fee);
// pool = new BAMM('Bounded AMM', 100, fee);

console.log("\n\n\n=======================================")
pool.join(100, 100);

let x = 10;
let y;
for (i = 0; i < 1; i++) {
	[x, y] = pool.buyY(x);
	[y, x]  = pool.buyX(y)
}

console.log("profit: "+ (x- 10).toFixed(4) + "X")

