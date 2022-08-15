import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as Enumerable from 'linq';
import * as dayjs from 'dayjs'
import { Dayjs } from 'dayjs';
import { ActivatedRoute, Router } from '@angular/router';

type Activity = {
  team: string,
  activity_type: string,
  title: string,
  activity_url: string,
  updated_at: Dayjs | string,
  updated_yyyymmdd: string,
  detail: string,
}

type YmdProjActivities = {
  ymd: string;
  projActivities: {
      proj: string;
      activities: Activity[];
  }[];
  updateAtMin: string | dayjs.Dayjs;
  updateAtMax: string | dayjs.Dayjs;
};

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  private domain = '';
  private apiKey = '';

  maxId = '';
  userId: string = '';

  error = '';

  private activities: Activity[] = [];
  ymdProjActivities: YmdProjActivities[] = [];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
  }

  async ngOnInit() {

    const q = this.activatedRoute.snapshot.queryParamMap;
    this.domain = q.get('domain') ?? '';
    this.apiKey = q.get('apikey') ?? '';

    if (this.domain == '' || this.apiKey == '') {
      this.error = 'https://<host>/#/?domain=<your-company-backlog-domain>&apikey=<your-backlog-api-key> を呼び出してください';
      return;
    }

    const res = await fetch(`https://${this.domain}/api/v2/users/myself?apiKey=${this.apiKey}`);
    if (!res.ok) {
      this.error = 'domain または apikey が正しくなさそうです';
      return;
    }
    this.userId = (await res.json()).id;

    this.activities.push(...(await this.loadActivities()));
    this.ymdProjActivities = this.summarize(this.activities);
  }

  async loadActivities(): Promise<Activity[]> {
    const activities: Activity[] = [];

    const contents = await (async () => {

      const count = 1;
      let i = 0;
      const contents = [];
      while (i < count) {
        const res = await fetch(`https://${this.domain}/api/v2/users/${this.userId}/activities?apiKey=${this.apiKey}&count=100&maxId=${this.maxId}`);
        const resJson = await res.json() as any[];
        contents.push(...resJson);
        this.maxId = resJson[resJson.length - 1].id;
        i++;
      }

      console.log(`${this.constructor.name} ~ ngOnInit ~ res1`, contents);
      return contents;
    })();
    console.log(`${this.constructor.name} ~ contents ~ contents`, contents);

    console.log(`${this.constructor.name} ~ ngOnInit ~ contents.map(c => c.type)`, contents.map(c => c.type));

    const manyContents = Enumerable.from(contents).selectMany(c => {
      if (c.type == 14) {
        console.log(`${this.constructor.name} ~ manyContents ~ c`, c);
        const childs = [];
        for (let index = 0; index < c.content.link.length; index++) {
          const l = c.content.link[index];
          console.log(`${this.constructor.name} ~ manyContents ~ l`, l);
          const c2 = {
            ...c,
            type: 3,
            content: {
              summary: l.title,
              key_id: l.key_id,
              comment: {...l.comment}
            }
          };
          console.log(`${this.constructor.name} ~ manyContents ~ c2`, c2);
          childs.push(c2)
        }
        return Enumerable.from(childs);
      }

      return Enumerable.from([c]);
    })

    for (const c of manyContents) {

      // type
      // 12: push
      // 13: repo 作成
      // 5: wiki:追加
      // 6: wiki:更新
      // 1: 課題:追加
      // 2: 課題:更新
      // 14: 課題の一括更新
      // 3: 課題:コメント追加

      let activity_url = '#';
      let title = '';
      let activity_type = '';
      let detail = '';

      if (c.type == 1) { // 課題:追加
        activity_type = '課題を追加';
        title = `${c.project.projectKey}-${c.content.key_id} ${c.content.summary}`;
        activity_url = `https://nepula.backlog.com/view/${c.project.projectKey}-${c.content?.key_id}`;
      } else if (c.type == 2) { // 課題:更新
        activity_type = '課題を更新';
        title = `${c.project.projectKey}-${c.content.key_id} ${c.content.summary}`;
        activity_url = `https://nepula.backlog.com/view/${c.project.projectKey}-${c.content?.key_id}`;
        detail = (c.content.changes as any[]).map(u => u.field_text).join(', ') + 'を更新';
      } else if (c.type == 3) { // 課題:コメント
        activity_type = '課題にコメント';
        title = `${c.project.projectKey}-${c.content.key_id} ${c.content.summary}`;
        activity_url = `https://nepula.backlog.com/view/${c.project.projectKey}-${c.content?.key_id}#comment-${c.content?.comment?.id}`;
        detail = String(c.content.comment.content).substring(0, 100) + '...';
      } else if (c.type == 5) { // wiki追加
        activity_type = 'Wiki を追加';
        activity_url = `https://nepula.backlog.com/wiki/${c.project.projectKey}/${c.content.name}`;
        detail = `${c.content.name} を追加`;
      } else if (c.type == 6) { // wiki更新
        activity_type = 'Wiki を更新';
        const version = c.content.version;
        activity_url = `https://nepula.backlog.com/wiki/${c.project.projectKey}/${c.content.name}/diff/${version - 1}...${version}`;
        detail = `${c.content.name} を更新`;
      } else if (c.type == 12) { // push
        activity_type = 'PUSH';
        title = `${c.content.repository.name} へ push`;
        const rev = c.content.revisions[0]?.rev;
        if (rev == null) {
          continue;
        }
        activity_url = `https://nepula.backlog.com/git/${c.project.projectKey}/${c.content.repository.name}/commit/${rev}`;
        const revs = c.content.revisions as any[]
        detail = `${revs[0].comment}、他 ${revs.length} 件のコミット`;
      } else if (c.type == 13) { // repo 作成
        activity_type = 'リポジトリ作成';
        title = `${c.content.repository.name} を作成`;
        activity_url = `https://nepula.backlog.com/git/${c.project.projectKey}/${c.content.repository.name}`;
      } else {
        console.log(`対応していない種類`, c);
        continue;
      }

      activities.push({
        updated_at: c.created,
        updated_yyyymmdd: dayjs(c.created).format('YYYY/MM/DD'),
        team: `[${c.project.projectKey}]${c.project.name}`,
        activity_type,
        title,
        activity_url,
        detail
      })
    }

    return activities;
  }

  private summarize(activities: Activity[]): YmdProjActivities[] {
    const itersPerYMD = Enumerable.from(activities).groupBy(x => x.updated_yyyymmdd);

    const ymdProjActivities = itersPerYMD.select(ymdGroup => {
      const ymd = ymdGroup.key();
      const ymdActivities = ymdGroup.getSource();
      console.log('ymd', ymd);
      console.log('ymdActivities', ymdActivities);

      const ymdActivityEnum = Enumerable.from(ymdGroup.getSource());
      const updateAtMin = ymdActivityEnum.minBy(x => dayjs(x.updated_at).toDate().getTime()).updated_at;
      const updateAtMax = ymdActivityEnum.maxBy(x => dayjs(x.updated_at).toDate().getTime()).updated_at;

      const projActivities = ymdActivityEnum.groupBy(x => x.team)
      .select(projGroup => {
        const proj = projGroup.key();
        const activities = Enumerable.from(projGroup.getSource()).orderBy(x => x.updated_at).toArray();
        console.log('proj', proj);
        console.log('projActivities', activities);
        return ({ proj, activities });
      }).toArray();

      return { ymd: ymdGroup.key(), projActivities, updateAtMin, updateAtMax };
    }).toArray();

    return ymdProjActivities;
  }

  async loadMore() {
    this.activities.push(...(await this.loadActivities()));
    this.ymdProjActivities = this.summarize(this.activities);
  }

  formatDate(value: Dayjs | string): string {
    if (value == null) {
      return '';
    }
    if (typeof value === 'string') {
      return dayjs(value).format('YYYY/MM/DD HH:mm:ss');
    } else {
      return value.format('YYYY/MM/DD HH:mm:ss');
    }
  }

  toHHMMSS(value: Dayjs | string): string {
    return dayjs(value).format('H:mm:ss');
  }
}
