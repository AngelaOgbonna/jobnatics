import os
import json
from pydantic import BaseModel

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "fairness_config.json")

class FairnessConfigModel(BaseModel):
    DIR_threshold: float = 0.80
    DPD_threshold: float = 0.10
    top_n_cohort: int = 100
    top_n_recommended: int = 10

def get_fairness_config() -> FairnessConfigModel:
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            return FairnessConfigModel(**data)
    return FairnessConfigModel()

def update_fairness_config(config: FairnessConfigModel):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config.model_dump() if hasattr(config, "model_dump") else config.dict(), f, indent=4)
    return config
