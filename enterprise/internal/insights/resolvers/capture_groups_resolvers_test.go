package resolvers

import (
	"testing"
	"time"
)

func TestBuildFrames(t *testing.T) {
	frames := BuildFrames(6, TimeInterval{
		unit:  "DAY",
		value: 4,
	}, time.Now())

	t.Log(frames)
}

//    [{2021-11-10 23:48:35.673201 +0000 UTC m=+0.041315466 2021-11-10 23:48:35.673201 +0000 UTC m=+0.041315466 }
//    {2021-11-10 23:48:35.673201 +0000 UTC m=+0.041315466 2021-11-06 23:48:35.673201 +0000 UTC }
//    {2021-11-06 23:48:35.673201 +0000 UTC 2021-11-02 23:48:35.673201 +0000 UTC }
//    {2021-11-02 23:48:35.673201 +0000 UTC 2021-10-29 23:48:35.673201 +0000 UTC }
//    {2021-10-29 23:48:35.673201 +0000 UTC 2021-10-25 23:48:35.673201 +0000 UTC }
//    {2021-10-25 23:48:35.673201 +0000 UTC 2021-10-21 23:48:35.673201 +0000 UTC }]
