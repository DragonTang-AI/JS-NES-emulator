// MMC3 IRQ Counter Fix - based on jsnes issue #595
// Fixes split-screen rendering for games like Mitsume ga Tooru, SMB3, Kirby

function applyMMC3Fix(nes) {
  if (!nes.mmap || nes.mmap.constructor.name !== "Mapper4") return;

  const mapper = nes.mmap;

  // Fix 1: Add reload flag tracking
  mapper.irqReloadPending = false;

  // Fix 2: Override write to swap $C000/$C001 roles
  const originalWrite = mapper.write.bind(mapper);
  mapper.write = function (address, value) {
    if (address < 0x8000) {
      // Delegate to parent for non-MMC3 addresses
      Object.getPrototypeOf(Object.getPrototypeOf(mapper)).write.call(
        this,
        address,
        value
      );
      return;
    }

    switch (address & 0xe001) {
      case 0x8000:
        this.command = value & 7;
        const tmp = (value >> 6) & 1;
        if (tmp !== this.prgAddressSelect) {
          this.prgAddressChanged = true;
        }
        this.prgAddressSelect = tmp;
        this.chrAddressSelect = (value >> 7) & 1;
        break;

      case 0x8001:
        this.executeCommand(this.command, value);
        break;

      case 0xa000:
        if ((value & 1) !== 0) {
          this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING);
        } else {
          this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING);
        }
        break;

      case 0xa001:
        break;

      case 0xc000:
        // FIXED: $C000 sets the LATCH (reload value), not the counter
        this.irqLatchValue = value;
        break;

      case 0xc001:
        // FIXED: $C001 sets reload flag, not the latch
        this.irqReloadPending = true;
        break;

      case 0xe000:
        // FIXED: Disable IRQ AND acknowledge pending IRQ
        this.irqEnable = 0;
        this.nes.cpu.irqRequested = false;
        break;

      case 0xe001:
        this.irqEnable = 1;
        break;
    }
  };

  // Fix 3: Override clockIrqCounter with correct logic
  mapper.clockIrqCounter = function () {
    // Counter should always clock, even when IRQ is disabled
    if (this.irqCounter === 0 || this.irqReloadPending) {
      // Reload from latch and clear reload flag
      this.irqCounter = this.irqLatchValue;
      this.irqReloadPending = false;
    } else {
      // Decrement counter
      this.irqCounter--;
    }

    // Fire IRQ when counter reaches 0 AND IRQs are enabled
    if (this.irqCounter === 0 && this.irqEnable === 1) {
      this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL);
    }
  };

  console.log("MMC3 IRQ fix applied successfully");
}
