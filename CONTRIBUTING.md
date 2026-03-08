# Contributing to TRINETRA

First off, thank you for considering contributing to TRINETRA! It's people like you that make TRINETRA such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**
- **Title**: Clear and descriptive title
- **Environment**: Chrome version, OS, extension version
- **Steps to Reproduce**: Numbered list of steps
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Screenshots**: If applicable
- **Console Errors**: Any errors from DevTools

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- Use a clear and descriptive title
- Provide a detailed description of the proposed feature
- Explain why this enhancement would be useful
- List any alternatives you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following our coding standards
4. **Add tests** for any new functionality
5. **Run tests**: `npm test`
6. **Run linting**: `npm run lint`
7. **Commit your changes** using conventional commits
8. **Push to your fork** and submit a pull request

## Development Setup

### Prerequisites
- Node.js v18 or higher
- npm v8 or higher
- Chrome browser
- Git

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/trinetra.git
cd trinetra

# Add upstream remote
git remote add upstream https://github.com/original/trinetra.git

# Install dependencies
npm install

# Start development
npm run dev
```

### Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from the project

## Coding Standards

### JavaScript
- Use ES6+ features
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public functions

### CSS
- Use BEM naming convention
- Use CSS custom properties for theming
- Mobile-first responsive design

### Commits
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(security): add phishing detection for shortened URLs
fix(popup): resolve task deletion not persisting
docs: update installation instructions
```

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests
- Place tests in the `tests/` directory
- Mirror the source file structure
- Use descriptive test names
- Aim for high coverage on critical paths

## Documentation

- Update README.md for user-facing changes
- Update docs/ for technical documentation
- Add JSDoc comments to new functions
- Include examples where helpful

## Review Process

1. All PRs require at least one review
2. CI checks must pass
3. Code coverage must not decrease
4. Documentation must be updated

## Recognition

Contributors are recognized in:
- GitHub contributors list
- README acknowledgments section
- Release notes for significant contributions

## Questions?

Feel free to open an issue with the "question" label or reach out to the maintainers.

---

Thank you for contributing to TRINETRA! 🙏
