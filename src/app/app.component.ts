import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as Enumerable from 'linq';
import * as dayjs from 'dayjs'
import { Dayjs } from 'dayjs';

type PR = {
  team: string,
  team_url: string,
  number: number,
  title: string,
  url: string,
  merged_at: Dayjs | string,
  updated_at: Dayjs | string,
  user_id: string,
  user_url: string,
  stars: number | undefined,
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'jamstack-sample-angular-node-spa';
  user = '';
  items: PR[] = [];
  lastUpdateAt?: Dayjs = undefined;
  latestOnly = true;

  get displayItems(): PR[] {
    return Enumerable.from(this.items)
    .where(pr => pr.updated_at != null)
    .orderByDescending(pr => pr.updated_at)
    .toArray();
}

  get lastUpdateAtFormatted(): string {
    return this.lastUpdateAt?.format('YYYY/MM/DD HH:mm:ss') ?? '';
  }

  constructor(private http: HttpClient) {

  }

  async ngOnInit() {
    // this.user = data.user;
    // this.items = data.data as PR[];
    // this.lastUpdateAt = dayjs(data.last_update_at);

    const apiKey = `QNNfuLmldRsEijezb91BxgLbHGvE50ChW1454x0OslGS7nH3Ghy7E8q8ljUKIIyc`;

    const userId = await (async () => {
      const res = await fetch(`https://nepula.backlog.com/api/v2/users/myself?apiKey=${apiKey}`);
      return (await res.json()).id;
    })();

    const contents = await (async () => {

      const count = 5;
      let i = 0;
      let maxId = '';
      const contents = [];
      while (i < count) {
        const res = await fetch(`https://nepula.backlog.com/api/v2/users/${userId}/activities?apiKey=${apiKey}&count=100&maxId=${maxId}`);
        const resJson = await res.json() as any[];
        contents.push(...resJson);
        maxId = resJson[resJson.length - 1].id;
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

      let url = '#';
      let title = '';
      let team_url = '';
      let user_id = '';

      if (c.type == 1) { // 課題:追加
        team_url = '課題を追加';
        title = `${c.project.projectKey}-${c.content.key_id} ${c.content.summary}`;
        url = `https://nepula.backlog.com/view/${c.project.projectKey}-${c.content?.key_id}`;
      } else if (c.type == 2) { // 課題:更新
        team_url = '課題を更新';
        title = `${c.project.projectKey}-${c.content.key_id} ${c.content.summary}`;
        url = `https://nepula.backlog.com/view/${c.project.projectKey}-${c.content?.key_id}`;
        user_id = (c.content.changes as any[]).map(u => u.field_text).join(', ') + 'を更新';
      } else if (c.type == 3) { // 課題:コメント
        team_url = '課題にコメント';
        title = `${c.project.projectKey}-${c.content.key_id} ${c.content.summary}`;
        url = `https://nepula.backlog.com/view/${c.project.projectKey}-${c.content?.key_id}#comment-${c.content?.comment?.id}`;
        user_id = String(c.content.comment.content).substring(0, 100) + '...';
      } else if (c.type == 5) { // wiki追加
        team_url = 'Wiki を追加';
        url = `https://nepula.backlog.com/wiki/${c.project.projectKey}/${c.content.name}`;
        user_id = `${c.content.name} を追加`;
      } else if (c.type == 6) { // wiki更新
        team_url = 'Wiki を更新';
        const version = c.content.version;
        url = `https://nepula.backlog.com/wiki/${c.project.projectKey}/${c.content.name}/diff/${version - 1}...${version}`;
        user_id = `${c.content.name} を更新`;
      } else if (c.type == 12) { // push
        team_url = 'PUSH';
        title = `${c.content.repository.name} へ push`;
        const rev = c.content.revisions[0]?.rev;
        if (rev == null) {
          continue;
        }
        url = `https://nepula.backlog.com/git/${c.project.projectKey}/${c.content.repository.name}/commit/${rev}`;
        const revs = c.content.revisions as any[]
        user_id = `${revs[0].comment}、他 ${revs.length} 件のコミット`;
      } else if (c.type == 13) { // repo 作成
        team_url = 'リポジトリ作成';
        title = `${c.content.repository.name} を作成`;
        url = `https://nepula.backlog.com/git/${c.project.projectKey}/${c.content.repository.name}`;
      } else {
        console.log(`対応していない種類`, c);
        continue;
      }

      this.items.push({
        updated_at: c.created,
        team: `[${c.project.projectKey}]${c.project.name}`,
        team_url,
        title,
        url,
        user_id
      } as PR)
    }

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
}
