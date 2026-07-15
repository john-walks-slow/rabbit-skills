---
name: tidy
description: 清理本 session 中无用/冗余的修改，
user-invocable: true
disable-model-invocation: true
---

# tidy

清理本 session 中已被证明无用或冗余的修改。清理非通用、不值得保留的调试日志打印。
只允许动手 edit，禁止使用 git reset、git checkout、git restore。

如果没有东西需要清理，则简单说明然后跳过 tidy。
