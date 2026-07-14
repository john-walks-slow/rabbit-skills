---
name: tidy
description: 撤销本 session 中无用/冗余的修改。手动 edit 回退，不使用 git revert/checkout。
user-invocable: true
disable-model-invocation: true
---

# tidy

撤销本 session 中已被证明无用或冗余的修改。
只动手 edit，禁止使用 git revert、git checkout、git restore。