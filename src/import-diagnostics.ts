import { BridgeError, ImportFailureDiagnostics } from './bridge-protocol';

// Per invocation; never shared between requests or reconstructed for old receipts.
export class ImportDiagnostics {
  phase: ImportFailureDiagnostics['phase'] = 'preparation';
  step = 'dispatch';
  nativeCallStarted = false;

  at(phase: ImportFailureDiagnostics['phase'], step: string): void {
    this.phase = phase;
    this.step = step;
  }

  failure(error: unknown): BridgeError {
    if (error instanceof BridgeError && error.diagnostics) return error;
    // Host exceptions need not be Error instances and can have throwing getters.
    const field = (key: string): unknown => {
      try { return error != null ? (error as any)[key] : undefined; } catch { return undefined; }
    };
    const bounded = (v: string, max: number) => v.slice(0, max).replace(/[\u0000-\u001f\u007f]/g, ' ');
    const name = field('name'), code = field('code'), message = field('message');
    const diagnostics: ImportFailureDiagnostics = {
      phase: this.phase,
      step: this.step,
      nativeCallStarted: this.nativeCallStarted,
      originalError: {
        type: bounded(typeof name === 'string' ? name : error === null ? 'null' : typeof error, 64),
        code: typeof code === 'string' ? bounded(code, 128) : typeof code === 'number' && Number.isFinite(code) ? code : null,
        message: bounded(typeof message === 'string' ? message : typeof error === 'string' ? error : 'No exception message.', 512),
      },
    };
    return new BridgeError(
      error instanceof BridgeError ? error.code : this.nativeCallStarted ? 'OPERATION_OUTCOME_UNKNOWN' : 'IMPORT_PREPARATION_FAILED',
      error instanceof BridgeError ? error.message : this.nativeCallStarted
        ? 'Import did not return a confirmed result. Inspect Premiere; do not retry under a new operationId.'
        : 'Import failed before the native import call. See diagnostics; this operationId retains its recorded failure.',
      diagnostics,
    );
  }
}
