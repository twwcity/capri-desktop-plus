"""Build a Thai voice for Capri from VIZINTZOR/MMS-TTS-THAI-FEMALEV2 (Omi; MALEV2 for D).
Usage: python convert-thai-voice.py <out folder> [VIZINTZOR/MMS-TTS-THAI-FEMALEV2 or VIZINTZOR/MMS-TTS-THAI-MALEV2]
Needs: pip install torch transformers onnx huggingface_hub. Then copy model.onnx into
voice/sherpa/vits-mms-tha-female (or -male) with tokens.txt from voice/sherpa/vits-mms-tha.

Export VIZINTZOR/MMS-TTS-THAI-FEMALEV2 (a transformers VitsModel) to an ONNX file that
sherpa-onnx loads the way it loads facebook/mms-tts-tha: inputs x, x_length, noise_scale,
length_scale, noise_scale_w; output y; the same metadata; tokens.txt from its vocab."""
import json
import os
import sys

import onnx
import torch
from huggingface_hub import snapshot_download
from transformers import VitsModel, VitsTokenizer

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
REPO = sys.argv[2] if len(sys.argv) > 2 else "VIZINTZOR/MMS-TTS-THAI-FEMALEV2"
src = snapshot_download(REPO, cache_dir=os.path.join(os.path.dirname(__file__), "hf"))
model = VitsModel.from_pretrained(src).eval()
tok = VitsTokenizer.from_pretrained(src)
print("sampling rate", model.config.sampling_rate, "add_blank", tok.add_blank, "vocab", len(tok.get_vocab()))


class Wrap(torch.nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x, x_length, noise_scale, length_scale, noise_scale_w):
        mask = (torch.arange(x.shape[1]).unsqueeze(0) < x_length.unsqueeze(1)).to(torch.long)
        # the knobs transformers keeps as plain numbers, made inputs
        self.m.noise_scale = noise_scale[0]
        self.m.noise_scale_duration = noise_scale_w[0]
        self.m.speaking_rate = 1.0 / length_scale[0]
        y = self.m(input_ids=x, attention_mask=mask).waveform
        return y.unsqueeze(1)


w = Wrap(model)
ids = tok(text="สวัสดีค่ะ นี่คือเสียงพูดภาษาไทย", return_tensors="pt").input_ids
args = (ids, torch.tensor([ids.shape[1]]), torch.tensor([0.667]), torch.tensor([1.0]), torch.tensor([0.8]))
path = os.path.join(OUT, "model.onnx")
torch.onnx.export(
    w, args, path, opset_version=17, dynamo=False,
    input_names=["x", "x_length", "noise_scale", "length_scale", "noise_scale_w"], output_names=["y"],
    dynamic_axes={"x": {0: "N", 1: "L"}, "x_length": {0: "N"}, "y": {0: "N", 2: "L"}},
)
m = onnx.load(path)
for k, v in {"model_type": "vits", "comment": "mms", "url": f"https://huggingface.co/{REPO}",
             "add_blank": "1", "language": "tha", "frontend": "characters", "n_speakers": "0",
             "sample_rate": str(model.config.sampling_rate)}.items():
    p = m.metadata_props.add()
    p.key, p.value = k, v
onnx.save(m, path)

vocab = tok.get_vocab()
with open(os.path.join(OUT, "tokens.txt"), "w", encoding="utf8") as f:
    for ch, i in sorted(vocab.items(), key=lambda kv: kv[1]):
        f.write(f"{ch} {i}\n")
print("saved", path, os.path.getsize(path))
