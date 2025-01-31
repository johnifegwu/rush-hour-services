import { getJestProjects } from '@nx/jest';

module.exports = async () => ({
  projects: getJestProjects(),
});
