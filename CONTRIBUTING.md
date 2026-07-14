# Contributing to Kuberna Labs

First off, thanks for taking the time to contribute! 🎉

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold its terms.

## How to Contribute

### 🐛 Report Bugs

1. Check existing [issues](https://github.com/kawacukennedy/kuberna-labs/issues) for duplicates
2. Use the [bug report template](https://github.com/kawacukennedy/kuberna-labs/issues/new?labels=bug&template=bug_report.md)
3. Include reproduction steps, expected vs actual behavior, and environment details

### 💡 Suggest Features

1. Search [existing discussions](https://github.com/kawacukennedy/kuberna-labs/discussions) for similar ideas
2. Use the [feature request template](https://github.com/kawacukennedy/kuberna-labs/issues/new?labels=enhancement&template=feature_request.md)
3. Explain the problem you're solving and how the feature would work

### 🛠️ Submit Code Changes

#### 1. Find or Create an Issue

- Start with [`good first issue`](https://github.com/kawacukennedy/kuberna-labs/labels/good%20first%20issue) or [`help wanted`](https://github.com/kawacukennedy/kuberna-labs/labels/help%20wanted) labels
- Comment on the issue to let others know you're working on it
- For new work, open an issue first to discuss before writing code

#### 2. Set Up Your Environment

```bash
# Clone the repo
git clone https://github.com/kawacukennedy/kuberna-labs.git
cd kuberna-labs

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

#### 3. Create a Branch

```bash
git checkout -b feat/my-feature
# or
git checkout -b fix/my-bugfix
```

Branch naming:
- `feat/` — new features
- `fix/` — bug fixes
- `docs/` — documentation only
- `test/` — test additions or fixes
- `refactor/` — code restructuring
- `chore/` — tooling, CI, dependencies

#### 4. Make Your Changes

- Follow the existing code style (Prettier and ESLint are configured)
- Add tests for new functionality
- Update documentation as needed
- Keep pull requests focused — one feature/fix per PR

#### 5. Run Checks

```bash
# Lint
npm run lint

# Format check
npm run format:check

# Run tests
npm test

# Smart contract tests
npx hardhat test

# Build
npm run build
```

#### 6. Commit

We use conventional commits:

```
feat: add cross-chain swap intent parser
fix: handle null balance in wallet query
docs: update README with new API endpoints
test: add unit tests for VirtualsManager
```

#### 7. Open a Pull Request

- Use the [pull request template](https://github.com/kawacukennedy/kuberna-labs/blob/main/.github/pull_request_template.md)
- Link the issue your PR addresses (`Closes #123`)
- Keep the description clear and focused
- Ensure all CI checks pass

### Areas to Contribute

| Area | Description | Location |
|---|---|---|
| **SDK** | TypeScript client library | `sdk/` |
| **Smart Contracts** | Solidity contracts (Escrow, Dispute, Router, etc.) | `contracts/` |
| **Backend** | Node.js API server | `backend/` |
| **Frontend** | Next.js dashboard | (root `pages/`, `components/`) |
| **Documentation** | README, guides, JSDoc, NatSpec | `.md` files, inline docs |
| **DevOps** | CI/CD, Docker, Render config | `.github/`, `render.yaml`, `Dockerfile` |

## Getting Help

- **Discord:** [Join the server](https://discord.gg/MZvNuhpXu)
- **Discussions:** [GitHub Discussions](https://github.com/kawacukennedy/kuberna-labs/discussions)
- **Issues:** Open a question issue or tag `@kawacukennedy`

## Recognition

Contributors are listed in our Discord and may be invited as project collaborators. First-time contributors get a special role in our community.
