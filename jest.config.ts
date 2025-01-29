import { getJestProjects } from '@nx/jest';

export default async () => ({
  projects: getJestProjects(),
});
