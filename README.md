# Pattern Field

Pattern Field is a minimal behavioral observation interface.

The system records intentional actions as binary signals over time.

```
1 = intentional action performed  
0 = no intentional action
```

Missing entries are treated as **0** in calculations but are visually distinguished as **missing observations**.

The interface is designed to be:

* calm
* neutral
* analytical
* non-judgmental

It is not a productivity tracker and contains no gamification.

## Features

* Record behaviors as binary signals
* 30-day visual observation grid
* Current run calculation
* Recurrence ratio (frequency over 30 days)
* Longest streak detection
* System-level analytics
* Data export and import
* Behavior deletion

## Philosophy

This system does not evaluate behavior.

Patterns are **observed**, not judged.

The goal is to reveal structural regularities in intentional actions rather than to motivate or reward them.

## Data Model

Each behavior is stored as:

```json
{
  "id": "string",
  "name": "behavior name",
  "observations": [
    { "date": "YYYY-MM-DD", "value": 1 }
  ]
}
```

Missing days are not stored.

## Storage

All data is stored locally in the browser using `localStorage`.

Export and import functions allow backup and restoration of the data.

## Deployment

The project is deployed using **GitHub Pages** as a static site.

## Project Structure

```
index.html        — Field view
analytics.html    — Analysis view
style.css         — UI styling
script.js         — application logic
```

## License

Personal experimental project.
