# Project Guidelines & Agent Instructions

## 1. Git Commit Management
- **Atomic Commits:** Make small, incremental, and logical commits for each distinct change or feature implementation.
- **Conventional Commit Messages:** Follow standard commit message formatting:
  - `feat:` New features or functionality
  - `fix:` Bug fixes and corrections
  - `docs:` Documentation changes (including README updates)
  - `style:` Formatting, missing semi-colons, aesthetic fixes
  - `refactor:` Code refactoring without changing logic or behavior
  - `test:` Adding or modifying unit/integration tests
  - `chore:` Dependency updates, build configurations, or minor maintenance
- **Descriptive Summaries:** Provide short, clear imperative titles (e.g., `feat: add kanban board column reordering`) and descriptive commit bodies when explaining non-obvious details.

## 2. Documentation & README Maintenance
- **Keep Documentation Synchronized:** Always update `README.md` whenever adding new features, changing configuration settings, adding dependencies, or altering project structure.
- **Clear Setup & Usage Instructions:** Ensure installation, startup, build commands, and environmental setup steps remain accurate and easy to follow.
- **Architecture & API Documentation:** Document core architectural decisions, workflow plans, and public API interfaces cleanly in `README.md` or within the `docs/` directory.

## 3. Standard Coding Practices & Structure
- **Code Consistency & Style:** Adhere strictly to industry standard style guidelines (e.g., PEP 8 for Python, standard style/ESLint for JavaScript/TypeScript) including formatting, naming conventions, and whitespace.
- **Clean & Modular Design:** 
  - Keep modules, components, and functions focused on single responsibilities.
  - Avoid duplicate code and extract shared logic into clear utility functions or components.
- **Type Annotations & Linting:** Use proper type hints and run linter/formatter tools prior to finalizing code changes.
- **Robust Error Handling:** 
  - Catch specific exceptions and return actionable error messages.
  - Avoid silent failures, swallowing errors, or using generic fallback values without proper logging.
- **Project File Hierarchy:** Follow the established directory layout. Keep core business logic, components, tests, and documentation neatly categorized into their designated subdirectories.
