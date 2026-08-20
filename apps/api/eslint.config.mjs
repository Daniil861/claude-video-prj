import nestConfig from '@video-meetings/eslint-config/nest';

export default [{ ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**'] }, ...nestConfig];
