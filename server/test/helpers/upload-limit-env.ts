/**
 * Must be imported FIRST by any test that needs a small upload ceiling:
 * `src/config.ts` reads the environment once at module load, so the variable
 * has to be set before the config module is evaluated. ES module imports are
 * evaluated in source order, so importing this file first is sufficient.
 */
process.env.MAX_UPLOAD_MB = process.env.MAX_UPLOAD_MB ?? '1';
export {};
